"""Leitura e escrita de contas, movimentos, recorrências e compromissos
no Postgres.

Movimentos: recebe DataFrames já no formato que
`ingestion_worker.extrato.carregar_extrato` produz (fingerprint,
duplicado, duplicado_possivel já calculados), para não duplicar a regra
de conciliação aqui.
"""

from __future__ import annotations

from collections import Counter
from datetime import date, datetime
from decimal import Decimal

import pandas as pd
from ingestion_worker.pluggy import CATEGORIA_ID_PAGAMENTO_DE_FATURA
from sqlalchemy import Numeric, and_, case, cast, delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from finance_api.categorias import (
    ORIGENS_DO_DONO,
    TIPOS_CLASSIFICAVEIS,
    OrigemDaCategoria,
    Regra,
    chave_do_destinatario,
    decidir,
    sem_acento,
)
from finance_api.compromissos import somar_meses
from finance_api.dinheiro_livre import CompromissoAtivo, RecorrenciaAprovada
from finance_api.models import (
    CategoriaORM,
    CompromissoORM,
    ContaORM,
    MovimentoORM,
    MovimentoTagORM,
    RecorrenciaORM,
    RegraDeCategoriaORM,
    TagORM,
)
from finance_api.recorrencias import LancamentoObservado, RecorrenciaCandidata

# Quantos dias podem separar a saída da conta corrente da baixa no cartão.
JANELA_PAGAMENTO_DE_FATURA_DIAS = 3
# Família "Transfers" da árvore de categorias da Pluggy. Pagar fatura é
# sempre transferência; compra em estabelecimento cai em outra família.
PREFIXO_CATEGORIA_TRANSFERENCIA = "05"


class PagamentoFaturaInvalido(ValueError):
    """A revisão tentou classificar um movimento incompatível como fatura."""


class CategoriaInvalida(ValueError):
    """Categoria que não existe, ou movimento que não leva categoria."""


def _nao_e_pagamento_de_fatura():
    """Movimento que deve contar como gasto de verdade.

    Fica de fora o que está marcado como pagamento de fatura (`detectado`
    ou `confirmado`): o gasto já está lançado como compra no cartão, contar
    os dois é contar duas vezes. `descartado` volta a contar.

    `NULL NOT IN (...)` seria nulo em SQL e derrubaria todo movimento
    comum, por isso a comparação é explícita.
    """
    return or_(
        MovimentoORM.pagamento_de_fatura.is_(None),
        MovimentoORM.pagamento_de_fatura == "descartado",
    )


def _como_data(valor: object) -> object:
    if isinstance(valor, str):
        # Data de extrato bancário não carrega fuso horário.
        return datetime.strptime(valor, "%Y-%m-%d").date()  # noqa: DTZ007
    return valor


def _decimal_ou_none(valor: object) -> Decimal | None:
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return None
    return Decimal(str(valor)).quantize(Decimal("0.01"))


def _texto_ou_none(valor: object) -> str | None:
    """Coluna ausente num DataFrame vira NaN, não None; os dois precisam
    virar NULL no banco."""
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return None
    return str(valor)


async def upsert_contas(sessao: AsyncSession, contas: list[dict]) -> None:
    """Grava ou atualiza contas (id, nome, tipo, saldo, limite,
    disponivel, bandeira, final, fechamento, vencimento), no formato que
    `ingestion_worker.pluggy.mapear_conta` produz. Roda a cada
    sincronização: saldo e limite ficam sempre com o valor mais recente
    que a Pluggy devolveu."""
    if not contas:
        return

    valores = [
        {
            "id": conta["id"],
            "nome": conta["nome"],
            "tipo": conta["tipo"],
            "saldo": _decimal_ou_none(conta["saldo"]),
            "limite": _decimal_ou_none(conta.get("limite")),
            "disponivel": _decimal_ou_none(conta.get("disponivel")),
            "bandeira": conta.get("bandeira"),
            "final": conta.get("final"),
            "item_id": conta.get("item_id"),
            "fechamento": _como_data(conta.get("fechamento")),
            "vencimento": _como_data(conta.get("vencimento")),
        }
        for conta in contas
    ]

    instrucao = pg_insert(ContaORM).values(valores)
    instrucao = instrucao.on_conflict_do_update(
        index_elements=["id"],
        set_={
            "nome": instrucao.excluded.nome,
            "tipo": instrucao.excluded.tipo,
            "saldo": instrucao.excluded.saldo,
            "limite": instrucao.excluded.limite,
            "disponivel": instrucao.excluded.disponivel,
            "bandeira": instrucao.excluded.bandeira,
            "final": instrucao.excluded.final,
            "item_id": instrucao.excluded.item_id,
            "fechamento": instrucao.excluded.fechamento,
            "vencimento": instrucao.excluded.vencimento,
            # `onupdate` do ORM não vale aqui: ON CONFLICT DO UPDATE é SQL
            # cru. Sem isto `atualizado_em` congela na primeira gravação e o
            # painel mostra uma idade de dado errada.
            "atualizado_em": func.now(),
            # `apelido` fica de fora de propósito: é escolha do Leonardo, não
            # dado da Pluggy, e listá-lo aqui faria cada sincronização apagar o
            # nome que ele deu.
        },
    )
    await sessao.execute(instrucao)
    await sessao.commit()


async def ultima_sincronizacao(sessao: AsyncSession) -> datetime | None:
    """Data/hora da conta mais recentemente gravada ou atualizada
    (`contas.atualizado_em`, `onupdate=func.now()` a cada sincronização).
    None quando não há nenhuma conta ainda."""
    resultado = await sessao.execute(select(func.max(ContaORM.atualizado_em)))
    return resultado.scalar_one_or_none()


async def listar_contas(sessao: AsyncSession) -> list[ContaORM]:
    resultado = await sessao.execute(select(ContaORM).order_by(ContaORM.nome, ContaORM.tipo))
    return list(resultado.scalars().all())


async def inserir_movimentos(
    sessao: AsyncSession, extrato: pd.DataFrame, proveniencia: str
) -> int:
    """Insere os movimentos de um extrato já processado.

    Ignora duplicidade confirmada (mesma linha de origem reimportada) via
    `ON CONFLICT DO NOTHING` na constraint única do banco
    (`fingerprint`, `identificador_externo`), então rodar a mesma
    importação mais de uma vez é seguro e não duplica saldo. A conta
    referenciada (`conta_id`) precisa já existir em `contas` (upsert
    antes, ver `upsert_contas`), por causa da chave estrangeira.
    """
    if extrato.empty:
        return 0

    valores = [
        {
            "conta_id": linha["conta_id"],
            "data": _como_data(linha["data"]),
            "valor": Decimal(str(linha["valor"])).quantize(Decimal("0.01")),
            "descricao": linha["descricao"],
            "tipo": linha["tipo"],
            "proveniencia": proveniencia,
            "identificador_externo": linha.get("identificador_externo") or None,
            "fingerprint": linha["fingerprint"],
            "duplicado_possivel": bool(linha.get("duplicado_possivel", False)),
            # Só a Pluggy categoriza; CSV e XML de NFS-e vêm sem isso.
            "categoria": _texto_ou_none(linha.get("categoria")),
            "categoria_id": _texto_ou_none(linha.get("categoria_id")),
        }
        for linha in extrato.to_dict("records")
    ]

    instrucao = pg_insert(MovimentoORM).values(valores)
    instrucao = instrucao.on_conflict_do_nothing(
        constraint="uq_movimentos_fingerprint_id"
    )
    resultado = await sessao.execute(instrucao)
    await sessao.commit()
    return resultado.rowcount or 0


def _para_classificar():
    """Receita ou despesa sem categoria própria. Pagamento de fatura fica de
    fora pelo mesmo motivo que fica fora do gasto."""
    return and_(
        MovimentoORM.tipo.in_(TIPOS_CLASSIFICAVEIS),
        _nao_e_pagamento_de_fatura(),
        MovimentoORM.categoria_propria.is_(None),
    )


async def listar_movimentos(
    sessao: AsyncSession,
    *,
    conta_id: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    para_classificar: bool = False,
    tag_id: int | None = None,
    limite: int = 100,
    offset: int = 0,
) -> list[MovimentoORM]:
    """Lista movimentos já gravados, mais recente primeiro, com filtro
    opcional por conta, por intervalo de data (inclusive nas duas
    pontas) e pelos que esperam categoria, e paginação simples
    (`limite`/`offset`)."""
    consulta = select(MovimentoORM).order_by(MovimentoORM.data.desc(), MovimentoORM.id.desc())
    if para_classificar:
        consulta = consulta.where(_para_classificar())
    if tag_id is not None:
        consulta = consulta.join(
            MovimentoTagORM, MovimentoTagORM.movimento_id == MovimentoORM.id
        ).where(MovimentoTagORM.tag_id == tag_id)
    if conta_id is not None:
        consulta = consulta.where(MovimentoORM.conta_id == conta_id)
    if data_inicio is not None:
        consulta = consulta.where(MovimentoORM.data >= data_inicio)
    if data_fim is not None:
        consulta = consulta.where(MovimentoORM.data <= data_fim)
    consulta = consulta.limit(limite).offset(offset)

    resultado = await sessao.execute(consulta)
    return list(resultado.scalars().all())


async def atualizar_conta(sessao: AsyncSession, conta_id: str, apelido: str | None) -> ContaORM | None:
    """Define ou limpa o apelido de uma conta. Devolve `None` se a conta não
    existe.

    `atualizado_em` vai no SET com o próprio valor porque o `onupdate` só
    dispara para coluna ausente do SET, e ela marca a última sincronização
    com a Pluggy: renomear não pode fazer saldo antigo parecer recém-buscado.
    """
    conta = await sessao.scalar(
        update(ContaORM)
        .where(ContaORM.id == conta_id)
        .values(apelido=apelido, atualizado_em=ContaORM.atualizado_em)
        .returning(ContaORM)
    )
    await sessao.commit()
    return conta


async def agregar_despesas_por_dia(
    sessao: AsyncSession,
    *,
    data_inicio: date,
    data_fim: date,
    conta_id: str | None = None,
) -> list[tuple[date, Decimal, Decimal]]:
    """Soma `valor` por `data`, só para `tipo == "despesa"`, no intervalo
    (inclusive nas duas pontas). Pagamento de fatura fica fora, ver
    `_nao_e_pagamento_de_fatura`."""
    consulta = (
        select(
            MovimentoORM.data,
            func.sum(MovimentoORM.valor),
            func.sum(
                case((MovimentoORM.duplicado_possivel.is_(True), MovimentoORM.valor), else_=0)
            ),
        )
        .where(
            MovimentoORM.tipo == "despesa",
            MovimentoORM.data >= data_inicio,
            MovimentoORM.data <= data_fim,
            _nao_e_pagamento_de_fatura(),
        )
        .group_by(MovimentoORM.data)
        .order_by(MovimentoORM.data)
    )
    if conta_id is not None:
        consulta = consulta.where(MovimentoORM.conta_id == conta_id)

    resultado = await sessao.execute(consulta)
    return [(linha.data, linha[1], linha[2]) for linha in resultado.all()]


async def agregar_fluxo_por_conta(
    sessao: AsyncSession,
    *,
    data_inicio: date,
    data_fim: date,
) -> list[tuple]:
    """Entradas e saídas de cada conta no intervalo (inclusive nas duas
    pontas), como `(conta_id, nome, apelido, tipo, entradas, saidas,
    em_revisao, fatura_paga, transferencias_entrada, transferencias_saida)`.

    Entrada é `receita` e saída é `despesa`, sem o pagamento de fatura: é o
    gasto de verdade, ver `_nao_e_pagamento_de_fatura`. O que move o próprio
    dinheiro vem à parte, porque não é gasto mas mexe no saldo da conta:
    fatura paga e transferência entre contas do titular (`aporte_titular` e
    `retirada_titular`, que incluem aplicação e resgate). Somando tudo, a
    variação do ciclo bate com a do saldo.

    Toda conta aparece, mesmo sem movimento no período: o painel mostra um
    card por conta e uma conta parada continua existindo. Daí o LEFT JOIN
    com a condição de data dentro do `ON`, e não no `WHERE`.
    """

    def soma_onde(*condicoes):
        # O cast é o que mantém o zero como "0.00" e não como "0": sem tipo
        # explícito o coalesce de uma soma vazia volta inteiro.
        return cast(
            func.coalesce(
                func.sum(case((and_(*condicoes), MovimentoORM.valor), else_=0)),
                0,
            ),
            Numeric(12, 2),
        )

    e_despesa = MovimentoORM.tipo == "despesa"
    consulta = (
        select(
            ContaORM.id,
            ContaORM.nome,
            ContaORM.apelido,
            ContaORM.tipo,
            soma_onde(MovimentoORM.tipo == "receita"),
            soma_onde(e_despesa, _nao_e_pagamento_de_fatura()),
            soma_onde(e_despesa, _nao_e_pagamento_de_fatura(), MovimentoORM.duplicado_possivel.is_(True)),
            soma_onde(e_despesa, MovimentoORM.pagamento_de_fatura.in_(("detectado", "confirmado"))),
            soma_onde(MovimentoORM.tipo == "aporte_titular"),
            soma_onde(MovimentoORM.tipo == "retirada_titular"),
        )
        .select_from(ContaORM)
        .outerjoin(
            MovimentoORM,
            and_(
                MovimentoORM.conta_id == ContaORM.id,
                MovimentoORM.data >= data_inicio,
                MovimentoORM.data <= data_fim,
            ),
        )
        .group_by(ContaORM.id, ContaORM.nome, ContaORM.apelido, ContaORM.tipo)
        .order_by(ContaORM.nome)
    )

    resultado = await sessao.execute(consulta)
    return [tuple(linha) for linha in resultado.all()]


async def entradas_do_dinheiro_livre(
    sessao: AsyncSession, *, inicio: date, hoje: date
) -> tuple[Decimal, Decimal, list[RecorrenciaAprovada], list[CompromissoAtivo], dict[date, Decimal]]:
    """O que `finance_api.dinheiro_livre.calcular` precisa, lido do banco:
    `(saldo_contas, cartao_usado, recorrencias, compromissos, gastos_por_dia)`.

    Gasto do dia a dia é despesa sem pagamento de fatura e sem conta fixa:
    as duas já são descontadas à parte, e contá-las de novo tiraria o mesmo
    dinheiro duas vezes da cota. Conta fixa é a despesa da mesma conta e
    descrição de uma recorrência aprovada, a chave que a detecção usa.
    """
    zero = Decimal(0)
    saldos = dict(
        (await sessao.execute(select(ContaORM.tipo, func.sum(ContaORM.saldo)).group_by(ContaORM.tipo))).all()
    )

    aprovadas = (
        await sessao.execute(
            select(RecorrenciaORM).where(RecorrenciaORM.status.in_(("aprovada", "parcelamento")))
        )
    ).scalars().all()
    ativos = (
        await sessao.execute(select(CompromissoORM).where(CompromissoORM.status == "ativo"))
    ).scalars().all()

    # Encerrada entra aqui também: o pagamento dela no ciclo já era conta fixa
    # quando saiu, não gasto do dia a dia.
    e_conta_fixa = (
        select(RecorrenciaORM.id)
        .where(
            RecorrenciaORM.status.in_(("aprovada", "parcelamento", "encerrada")),
            RecorrenciaORM.conta_id == MovimentoORM.conta_id,
            RecorrenciaORM.descricao == MovimentoORM.descricao,
        )
        .exists()
    )
    gastos = (
        await sessao.execute(
            select(MovimentoORM.data, func.sum(MovimentoORM.valor))
            .where(
                MovimentoORM.tipo == "despesa",
                MovimentoORM.data >= inicio,
                MovimentoORM.data <= hoje,
                _nao_e_pagamento_de_fatura(),
                ~e_conta_fixa,
            )
            .group_by(MovimentoORM.data)
        )
    ).all()

    return (
        saldos.get("BANK") or zero,
        saldos.get("CREDIT") or zero,
        [
            RecorrenciaAprovada(
                recorrencia.apelido or recorrencia.descricao,
                recorrencia.valor_medio,
                recorrencia.ultima_data,
                recorrencia.fim_previsto,
            )
            for recorrencia in aprovadas
        ],
        [
            CompromissoAtivo(compromisso.descricao, compromisso.valor_parcela, compromisso.data_inicio, compromisso.data_fim)
            for compromisso in ativos
        ],
        {data: total for data, total in gastos},
    )


async def lancamentos_para_deteccao(sessao: AsyncSession) -> list[LancamentoObservado]:
    """As despesas já gravadas, no formato mínimo que
    `finance_api.recorrencias.detectar_recorrencias` precisa."""
    consulta = select(
        MovimentoORM.conta_id,
        MovimentoORM.descricao,
        MovimentoORM.data,
        MovimentoORM.valor,
    ).where(
        MovimentoORM.tipo == "despesa",
        MovimentoORM.duplicado_possivel.is_(False),
        _nao_e_pagamento_de_fatura(),
    )

    resultado = await sessao.execute(consulta)
    return [
        LancamentoObservado(
            conta_id=linha.conta_id,
            descricao=linha.descricao,
            data=linha.data,
            valor=linha.valor,
        )
        for linha in resultado.all()
    ]


async def marcar_pagamentos_de_fatura(sessao: AsyncSession) -> int:
    """Marca como `detectado` a saída de conta corrente que corresponde ao
    pagamento de uma fatura de cartão.

    A Pluggy só dá categoria própria a esse evento do lado do cartão
    (`05100000`); do lado da conta corrente ele vem como "Transfers"
    genérico, junto com Pix e TED que são gasto de verdade. Por isso o
    casamento exige as duas pernas, e o candidato precisa satisfazer tudo
    isto:

    - ser despesa de conta corrente com categoria de transferência
      (`05...`), já que pagar fatura nunca é compra em estabelecimento;
    - ter, num cartão, uma baixa de fatura de mesmo valor, com até
      `JANELA_PAGAMENTO_DE_FATURA_DIAS` dias de diferença.

    Só mexe em movimento sem estado: nunca sobrescreve `confirmado` nem
    `descartado`.

    Uma baixa paga uma saída só, também entre sincronizações. A marcação não
    guarda qual baixa usou, então a baixa que casa com alguma saída já
    `detectado` ou `confirmado` conta como usada. Na ambiguidade a saída nova
    fica sem marca e continua somando como gasto, o erro que aparece na tela.
    """
    banco = aliased(MovimentoORM)
    conta_do_banco = aliased(ContaORM)
    cartao = aliased(MovimentoORM)
    conta_do_cartao = aliased(ContaORM)
    ja_marcado = aliased(MovimentoORM)
    conta_do_marcado = aliased(ContaORM)

    baixa_ja_usada = (
        select(ja_marcado.id)
        .join(conta_do_marcado, conta_do_marcado.id == ja_marcado.conta_id)
        .where(
            conta_do_marcado.tipo == "BANK",
            ja_marcado.tipo == "despesa",
            ja_marcado.pagamento_de_fatura.in_(("detectado", "confirmado")),
            ja_marcado.valor == cartao.valor,
            func.abs(cartao.data - ja_marcado.data) <= JANELA_PAGAMENTO_DE_FATURA_DIAS,
        )
        .exists()
    )

    consulta = (
        select(banco.id, cartao.id)
        .select_from(banco)
        .join(conta_do_banco, conta_do_banco.id == banco.conta_id)
        .join(
            cartao,
            and_(
                cartao.valor == banco.valor,
                func.abs(cartao.data - banco.data) <= JANELA_PAGAMENTO_DE_FATURA_DIAS,
            ),
        )
        .join(conta_do_cartao, conta_do_cartao.id == cartao.conta_id)
        .where(
            conta_do_banco.tipo == "BANK",
            banco.tipo == "despesa",
            banco.duplicado_possivel.is_(False),
            banco.pagamento_de_fatura.is_(None),
            banco.categoria_id.like(f"{PREFIXO_CATEGORIA_TRANSFERENCIA}%"),
            conta_do_cartao.tipo == "CREDIT",
            cartao.duplicado_possivel.is_(False),
            cartao.categoria_id == CATEGORIA_ID_PAGAMENTO_DE_FATURA,
            ~baixa_ja_usada,
        )
    )
    pares = [(linha[0], linha[1]) for linha in (await sessao.execute(consulta)).all()]
    por_banco = Counter(banco_id for banco_id, _ in pares)
    por_cartao = Counter(cartao_id for _, cartao_id in pares)
    ids = [
        banco_id
        for banco_id, cartao_id in pares
        if por_banco[banco_id] == 1 and por_cartao[cartao_id] == 1
    ]
    if not ids:
        return 0

    instrucao = update(MovimentoORM).where(MovimentoORM.id.in_(ids)).values(
        pagamento_de_fatura="detectado"
    )
    resultado = await sessao.execute(instrucao)
    await sessao.commit()
    return resultado.rowcount or 0


async def listar_pagamentos_de_fatura(
    sessao: AsyncSession, *, estado: str | None = None
) -> list[MovimentoORM]:
    """Os movimentos que o Mercúrio concluiu (ou ele decidiu) serem
    pagamento de fatura, para revisão."""
    consulta = select(MovimentoORM).order_by(MovimentoORM.data.desc(), MovimentoORM.id.desc())
    if estado is None:
        consulta = consulta.where(MovimentoORM.pagamento_de_fatura.is_not(None))
    else:
        consulta = consulta.where(MovimentoORM.pagamento_de_fatura == estado)

    resultado = await sessao.execute(consulta)
    return list(resultado.scalars().all())


async def definir_pagamento_de_fatura(
    sessao: AsyncSession, movimento_id: int, estado: str
) -> MovimentoORM | None:
    """Aplica a decisão humana a uma despesa de conta bancária."""
    movimento = await sessao.get(MovimentoORM, movimento_id)
    if movimento is None:
        return None

    tipo_da_conta = await sessao.scalar(
        select(ContaORM.tipo).where(ContaORM.id == movimento.conta_id)
    )
    if movimento.tipo != "despesa" or tipo_da_conta != "BANK":
        raise PagamentoFaturaInvalido(
            "somente despesa de conta bancária pode ser pagamento de fatura"
        )
    if estado == "descartado" and movimento.pagamento_de_fatura is None:
        raise PagamentoFaturaInvalido(
            "somente uma marcação existente pode ser descartada"
        )

    movimento.pagamento_de_fatura = estado
    await sessao.commit()
    await sessao.refresh(movimento)
    return movimento


async def salvar_recorrencias_detectadas(
    sessao: AsyncSession, candidatas: list[RecorrenciaCandidata]
) -> int:
    """Grava as candidatas encontradas, atualizando as que já existiam.

    Uma recorrência já rejeitada nunca é tocada: a
    detecção reencontra o mesmo padrão a cada sincronização, e sem essa
    trava a rejeição voltaria sozinha para a fila no dia seguinte.
    Recorrência já aprovada continua aprovada, só tem os números
    atualizados.
    """
    if not candidatas:
        return 0

    valores = [
        {
            "conta_id": candidata.conta_id,
            "descricao": candidata.descricao,
            "valor_medio": candidata.valor_medio,
            "ocorrencias": candidata.ocorrencias,
            "primeira_data": candidata.primeira_data,
            "ultima_data": candidata.ultima_data,
            "status": "pendente",
        }
        for candidata in candidatas
    ]

    instrucao = pg_insert(RecorrenciaORM).values(valores)
    instrucao = instrucao.on_conflict_do_update(
        constraint="uq_recorrencias_conta_descricao",
        set_={
            "valor_medio": instrucao.excluded.valor_medio,
            "ocorrencias": instrucao.excluded.ocorrencias,
            "primeira_data": instrucao.excluded.primeira_data,
            "ultima_data": instrucao.excluded.ultima_data,
            "atualizado_em": func.now(),
        },
        where=RecorrenciaORM.status != "rejeitada",
    )
    resultado = await sessao.execute(instrucao)
    await sessao.commit()
    return resultado.rowcount or 0


async def listar_recorrencias(
    sessao: AsyncSession, *, status: str | None = None
) -> list[RecorrenciaORM]:
    consulta = select(RecorrenciaORM).order_by(
        RecorrenciaORM.ultima_data.desc(), RecorrenciaORM.id.desc()
    )
    if status is not None:
        consulta = consulta.where(RecorrenciaORM.status == status)

    resultado = await sessao.execute(consulta)
    return list(resultado.scalars().all())


async def atualizar_recorrencia(
    sessao: AsyncSession, recorrencia_id: int, campos: dict
) -> RecorrenciaORM | None:
    """Muda status e/ou classificação (apelido, categoria) de uma
    recorrência. Devolve None se o id não existe.

    Parcelamento guarda a data da última parcela: a próxima cobrança é um mês
    depois da última vista, e cada parcela que falta soma um mês. Qualquer
    outro estado apaga essa data.
    """
    recorrencia = await sessao.get(RecorrenciaORM, recorrencia_id)
    if recorrencia is None:
        return None

    parcelas_restantes = campos.pop("parcelas_restantes", None)
    if "status" in campos:
        recorrencia.fim_previsto = (
            somar_meses(recorrencia.ultima_data, parcelas_restantes)
            if campos["status"] == "parcelamento"
            else None
        )
    for nome, valor in campos.items():
        setattr(recorrencia, nome, valor)
    await sessao.commit()
    await sessao.refresh(recorrencia)
    return recorrencia


async def criar_compromisso(sessao: AsyncSession, dados: dict) -> CompromissoORM:
    compromisso = CompromissoORM(**dados)
    sessao.add(compromisso)
    await sessao.commit()
    await sessao.refresh(compromisso)
    return compromisso


async def obter_compromisso(
    sessao: AsyncSession, compromisso_id: int
) -> CompromissoORM | None:
    return await sessao.get(CompromissoORM, compromisso_id)


async def listar_compromissos(
    sessao: AsyncSession, *, status: str | None = None
) -> list[CompromissoORM]:
    consulta = select(CompromissoORM).order_by(
        CompromissoORM.data_inicio, CompromissoORM.id
    )
    if status is not None:
        consulta = consulta.where(CompromissoORM.status == status)

    resultado = await sessao.execute(consulta)
    return list(resultado.scalars().all())


async def atualizar_compromisso(
    sessao: AsyncSession, compromisso: CompromissoORM, campos: dict
) -> CompromissoORM:
    for nome, valor in campos.items():
        setattr(compromisso, nome, valor)
    await sessao.commit()
    await sessao.refresh(compromisso)
    return compromisso


async def carregar_movimentos(sessao: AsyncSession) -> pd.DataFrame:
    """Devolve os movimentos gravados no mesmo formato que
    `resumir_por_conta` espera. Não há duplicidade confirmada para
    remover aqui: a constraint única do banco já garante isso na escrita.
    """
    resultado = await sessao.execute(select(MovimentoORM))
    movimentos = resultado.scalars().all()

    return pd.DataFrame(
        [
            {
                "conta_id": movimento.conta_id,
                "valor": float(movimento.valor),
                "tipo": movimento.tipo,
                "fingerprint": movimento.fingerprint,
                "identificador_externo": movimento.identificador_externo,
                "duplicado": False,
                "duplicado_possivel": movimento.duplicado_possivel,
            }
            for movimento in movimentos
        ]
    )


async def listar_categorias(sessao: AsyncSession) -> list[CategoriaORM]:
    resultado = await sessao.execute(select(CategoriaORM).order_by(CategoriaORM.ordem))
    return list(resultado.scalars().all())


async def carregar_regras(sessao: AsyncSession) -> dict[str, Regra]:
    resultado = await sessao.execute(select(RegraDeCategoriaORM.chave, RegraDeCategoriaORM.categoria_id))
    return {chave: Regra(categoria) for chave, categoria in resultado.all()}


async def classificar_movimentos(sessao: AsyncSession) -> int:
    """Recalcula a categoria de todo movimento sem escolha do dono, pela
    ordem de `finance_api.categorias.decidir`. Roda depois de cada
    sincronização e de cada correção, então regra nova também alcança os
    movimentos antigos que o Mercúrio tinha classificado sozinho. Devolve
    quantos mudaram."""
    regras = await carregar_regras(sessao)
    automaticos = (
        await sessao.execute(
            select(
                MovimentoORM.id,
                MovimentoORM.descricao,
                MovimentoORM.tipo,
                MovimentoORM.pagamento_de_fatura,
                MovimentoORM.categoria_id,
                MovimentoORM.categoria_propria,
                MovimentoORM.origem_da_categoria,
            ).where(
                or_(
                    MovimentoORM.origem_da_categoria.is_(None),
                    MovimentoORM.origem_da_categoria.not_in(ORIGENS_DO_DONO),
                )
            )
        )
    ).all()

    mudancas = []
    for linha in automaticos:
        categoria, origem = decidir(
            tipo=linha.tipo,
            fatura=linha.pagamento_de_fatura in ("detectado", "confirmado"),
            regra=regras.get(chave_do_destinatario(linha.descricao)),
            categoria_id_da_pluggy=linha.categoria_id,
        )
        if (categoria, origem) != (linha.categoria_propria, linha.origem_da_categoria):
            mudancas.append({"id": linha.id, "categoria_propria": categoria, "origem_da_categoria": origem})

    if mudancas:
        await sessao.execute(update(MovimentoORM), mudancas)
    await sessao.commit()
    return len(mudancas)


async def contar_para_classificar(sessao: AsyncSession, *, desde: date) -> int:
    return (
        await sessao.scalar(
            select(func.count())
            .select_from(MovimentoORM)
            .where(_para_classificar(), MovimentoORM.data >= desde)
        )
        or 0
    )


async def historico_dos_destinatarios(
    sessao: AsyncSession, chaves: set[str]
) -> dict[str, list[tuple[str, int]]]:
    """As categorias que o dono já deu a cada destinatário, da mais usada
    para a menos, para a fila de classificação sugerir primeiro o provável."""
    if not chaves:
        return {}
    escolhidos = (
        await sessao.execute(
            select(MovimentoORM.descricao, MovimentoORM.categoria_propria).where(
                MovimentoORM.origem_da_categoria.in_(ORIGENS_DO_DONO)
            )
        )
    ).all()
    contagem: dict[str, Counter[str]] = {chave: Counter() for chave in chaves}
    for descricao, categoria in escolhidos:
        chave = chave_do_destinatario(descricao)
        if chave in contagem and categoria is not None:
            contagem[chave][categoria] += 1
    return {chave: contador.most_common() for chave, contador in contagem.items() if contador}


async def _escolher(
    sessao: AsyncSession, movimento: MovimentoORM, categoria: str, *, todos_do_destinatario: bool
) -> None:
    """A escolha do dono num movimento, sem gravar: quem chama faz o commit
    e reclassifica uma vez só, mesmo marcando vários."""
    if movimento.tipo not in TIPOS_CLASSIFICAVEIS:
        raise CategoriaInvalida("só receita e despesa levam categoria")
    movimento.categoria_propria = categoria
    movimento.origem_da_categoria = OrigemDaCategoria.DONO.value
    chave = chave_do_destinatario(movimento.descricao)
    if todos_do_destinatario:
        instrucao = pg_insert(RegraDeCategoriaORM).values(
            chave=chave, categoria_id=categoria, origem=OrigemDaCategoria.DONO.value
        )
        await sessao.execute(
            instrucao.on_conflict_do_update(
                index_elements=["chave"],
                set_={
                    "categoria_id": categoria,
                    "origem": OrigemDaCategoria.DONO.value,
                    "atualizado_em": func.now(),
                },
            )
        )
    else:
        await sessao.execute(
            update(RegraDeCategoriaORM)
            .where(
                RegraDeCategoriaORM.chave == chave,
                RegraDeCategoriaORM.categoria_id.is_not(None),
                RegraDeCategoriaORM.categoria_id != categoria,
            )
            .values(categoria_id=None, origem=OrigemDaCategoria.DONO.value)
        )


async def _conferir_categoria(sessao: AsyncSession, categoria: str) -> None:
    if await sessao.get(CategoriaORM, categoria) is None:
        raise CategoriaInvalida(f"categoria desconhecida: {categoria}")


async def corrigir_categoria(
    sessao: AsyncSession, movimento_id: int, categoria: str, *, todos_do_destinatario: bool
) -> MovimentoORM | None:
    """Grava a escolha do dono num movimento. Devolve `None` se ele não existe.

    Com `todos_do_destinatario`, a escolha vira regra e alcança os movimentos
    antigos dele que o Mercúrio tinha classificado sozinho; os que o dono já
    escolheu ficam como estão. Sem isso, escolher outra categoria que a da
    regra mostra que o destinatário recebe por coisas diferentes: a regra
    vira mista e os próximos dele ficam para classificar.
    """
    movimento = await sessao.get(MovimentoORM, movimento_id)
    if movimento is None:
        return None
    await _conferir_categoria(sessao, categoria)
    await _escolher(sessao, movimento, categoria, todos_do_destinatario=todos_do_destinatario)
    await sessao.commit()
    await classificar_movimentos(sessao)
    await sessao.refresh(movimento)
    return movimento


async def criar_categoria(sessao: AsyncSession, nome: str, icone: str, cor: int) -> CategoriaORM:
    """Categoria nova do dono, no fim da lista. O id sai do nome sem acento,
    com número no fim quando já existe."""
    nome = nome.strip()
    existentes = (await sessao.execute(select(CategoriaORM.id, CategoriaORM.nome))).all()
    if any(sem_acento(outro) == sem_acento(nome) for _, outro in existentes):
        raise CategoriaInvalida(f"já existe a categoria {nome}")
    base = "-".join(sem_acento(nome).split())[:36] or "categoria"
    ids = {id_ for id_, _ in existentes}
    id_, numero = base, 2
    while id_ in ids:
        id_, numero = f"{base}-{numero}", numero + 1
    ordem = (await sessao.scalar(select(func.max(CategoriaORM.ordem)))) or 0
    categoria = CategoriaORM(id=id_, nome=nome, icone=icone, cor=cor, ordem=ordem + 1)
    sessao.add(categoria)
    await sessao.commit()
    return categoria


async def _tags_por_nome(sessao: AsyncSession, nomes: list[str]) -> list[int]:
    """Os ids das tags com esses nomes, criando as que faltam. O nome é único
    sem distinção de caixa: "Viagem Rio" e "viagem rio" são a mesma tag."""
    limpos = list(dict.fromkeys(nome.strip() for nome in nomes if nome.strip()))
    if not limpos:
        return []
    procurados = [nome.lower() for nome in limpos]
    existentes = {
        nome.lower(): id_
        for id_, nome in (
            await sessao.execute(
                select(TagORM.id, TagORM.nome).where(func.lower(TagORM.nome).in_(procurados))
            )
        ).all()
    }
    ids = []
    for nome in limpos:
        if nome.lower() not in existentes:
            tag = TagORM(nome=nome)
            sessao.add(tag)
            await sessao.flush()
            existentes[nome.lower()] = tag.id
        ids.append(existentes[nome.lower()])
    return list(dict.fromkeys(ids))


async def definir_tags(
    sessao: AsyncSession, movimento_id: int, nomes: list[str]
) -> MovimentoORM | None:
    """Troca as tags de um movimento pelas desta lista."""
    movimento = await sessao.get(MovimentoORM, movimento_id)
    if movimento is None:
        return None
    ids = await _tags_por_nome(sessao, nomes)
    await sessao.execute(
        delete(MovimentoTagORM).where(MovimentoTagORM.movimento_id == movimento_id)
    )
    if ids:
        await sessao.execute(
            pg_insert(MovimentoTagORM).values(
                [{"movimento_id": movimento_id, "tag_id": id_} for id_ in ids]
            )
        )
    await sessao.commit()
    return movimento


async def marcar_em_lote(
    sessao: AsyncSession, ids: list[int], *, categoria: str | None, tag: str | None
) -> int:
    """Dá a mesma categoria (só a estes, sem virar regra) ou acrescenta a
    mesma tag a vários movimentos. Movimento que não leva categoria fica com
    a que tinha. Devolve quantos movimentos existiam."""
    movimentos = list(
        (await sessao.execute(select(MovimentoORM).where(MovimentoORM.id.in_(ids)))).scalars()
    )
    if categoria is not None:
        await _conferir_categoria(sessao, categoria)
        for movimento in movimentos:
            if movimento.tipo in TIPOS_CLASSIFICAVEIS:
                await _escolher(sessao, movimento, categoria, todos_do_destinatario=False)
    tag_ids = await _tags_por_nome(sessao, [tag]) if tag is not None else []
    if tag_ids and movimentos:
        await sessao.execute(
            pg_insert(MovimentoTagORM)
            .values([{"movimento_id": movimento.id, "tag_id": tag_ids[0]} for movimento in movimentos])
            .on_conflict_do_nothing()
        )
    await sessao.commit()
    if categoria is not None:
        await classificar_movimentos(sessao)
    return len(movimentos)


async def tags_dos_movimentos(sessao: AsyncSession, ids: list[int]) -> dict[int, list[str]]:
    if not ids:
        return {}
    resultado = await sessao.execute(
        select(MovimentoTagORM.movimento_id, TagORM.nome)
        .join(TagORM, TagORM.id == MovimentoTagORM.tag_id)
        .where(MovimentoTagORM.movimento_id.in_(ids))
        .order_by(TagORM.nome)
    )
    tags: dict[int, list[str]] = {}
    for movimento_id, nome in resultado.all():
        tags.setdefault(movimento_id, []).append(nome)
    return tags


def _gasto():
    """Quanto saiu: despesa sem pagamento de fatura, como no gasto por dia."""
    return cast(
        func.coalesce(
            func.sum(
                case(
                    (
                        and_(MovimentoORM.tipo == "despesa", _nao_e_pagamento_de_fatura()),
                        MovimentoORM.valor,
                    ),
                    else_=0,
                )
            ),
            0,
        ),
        Numeric(12, 2),
    )


async def listar_tags(sessao: AsyncSession) -> list[tuple]:
    """Cada tag como `(id, nome, gasto, quantidade, primeira_data,
    ultima_data)`, a de movimento mais recente primeiro."""
    resultado = await sessao.execute(
        select(
            TagORM.id,
            TagORM.nome,
            _gasto(),
            func.count(MovimentoORM.id),
            func.min(MovimentoORM.data),
            func.max(MovimentoORM.data),
        )
        .select_from(TagORM)
        .outerjoin(MovimentoTagORM, MovimentoTagORM.tag_id == TagORM.id)
        .outerjoin(MovimentoORM, MovimentoORM.id == MovimentoTagORM.movimento_id)
        .group_by(TagORM.id, TagORM.nome)
        .order_by(func.max(MovimentoORM.data).desc().nulls_last(), TagORM.nome)
    )
    return [tuple(linha) for linha in resultado.all()]


async def gasto_da_tag_por_categoria(
    sessao: AsyncSession, tag_id: int
) -> list[tuple[str | None, Decimal]]:
    """O gasto da tag dividido pela categoria do Mercúrio, do maior para o menor."""
    resultado = await sessao.execute(
        select(MovimentoORM.categoria_propria, _gasto())
        .join(MovimentoTagORM, MovimentoTagORM.movimento_id == MovimentoORM.id)
        .where(MovimentoTagORM.tag_id == tag_id)
        .group_by(MovimentoORM.categoria_propria)
        .having(_gasto() > 0)
        .order_by(_gasto().desc())
    )
    return [(categoria, total) for categoria, total in resultado.all()]
