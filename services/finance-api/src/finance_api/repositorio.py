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
from sqlalchemy import Numeric, and_, case, cast, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from finance_api.models import CompromissoORM, ContaORM, MovimentoORM, RecorrenciaORM
from finance_api.recorrencias import LancamentoObservado, RecorrenciaCandidata

# Quantos dias podem separar a saída da conta corrente da baixa no cartão.
JANELA_PAGAMENTO_DE_FATURA_DIAS = 3
# Família "Transfers" da árvore de categorias da Pluggy. Pagar fatura é
# sempre transferência; compra em estabelecimento cai em outra família.
PREFIXO_CATEGORIA_TRANSFERENCIA = "05"


class PagamentoFaturaInvalido(ValueError):
    """A revisão tentou classificar um movimento incompatível como fatura."""


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


async def listar_movimentos(
    sessao: AsyncSession,
    *,
    conta_id: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    limite: int = 100,
    offset: int = 0,
) -> list[MovimentoORM]:
    """Lista movimentos já gravados, mais recente primeiro, com filtro
    opcional por conta e por intervalo de data (inclusive nas duas
    pontas) e paginação simples (`limite`/`offset`)."""
    consulta = select(MovimentoORM).order_by(MovimentoORM.data.desc(), MovimentoORM.id.desc())
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
    existe."""
    conta = await sessao.get(ContaORM, conta_id)
    if conta is None:
        return None
    conta.apelido = apelido
    await sessao.commit()
    await sessao.refresh(conta)
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
) -> list[tuple[str, str, str | None, str, Decimal, Decimal, Decimal]]:
    """Entradas e saídas de cada conta no intervalo (inclusive nas duas
    pontas), como `(conta_id, nome, apelido, tipo, entradas, saidas, em_revisao)`.

    Entrada é `receita`, saída é `despesa`; transferência entre contas próprias
    (`aporte_titular`/`retirada_titular`) fica fora dos dois, porque não é
    dinheiro entrando nem saindo do conjunto. Pagamento de fatura sai das
    despesas pelo mesmo motivo, ver `_nao_e_pagamento_de_fatura`.

    Toda conta aparece, mesmo sem movimento no período: o painel mostra um
    card por conta e uma conta parada continua existindo. Daí o LEFT JOIN
    com a condição de data dentro do `ON`, e não no `WHERE`.
    """

    def soma_de(tipo: str):
        # O cast é o que mantém o zero como "0.00" e não como "0": sem tipo
        # explícito o coalesce de uma soma vazia volta inteiro.
        return cast(
            func.coalesce(
                func.sum(case((MovimentoORM.tipo == tipo, MovimentoORM.valor), else_=0)),
                0,
            ),
            Numeric(12, 2),
        )

    consulta = (
        select(
            ContaORM.id,
            ContaORM.nome,
            ContaORM.apelido,
            ContaORM.tipo,
            soma_de("receita"),
            soma_de("despesa"),
            cast(
                func.coalesce(
                    func.sum(
                        case(
                            (
                                and_(
                                    MovimentoORM.tipo == "despesa",
                                    MovimentoORM.duplicado_possivel.is_(True),
                                ),
                                MovimentoORM.valor,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ),
                Numeric(12, 2),
            ),
        )
        .select_from(ContaORM)
        .outerjoin(
            MovimentoORM,
            and_(
                MovimentoORM.conta_id == ContaORM.id,
                MovimentoORM.data >= data_inicio,
                MovimentoORM.data <= data_fim,
                _nao_e_pagamento_de_fatura(),
            ),
        )
        .group_by(ContaORM.id, ContaORM.nome, ContaORM.apelido, ContaORM.tipo)
        .order_by(ContaORM.nome)
    )

    resultado = await sessao.execute(consulta)
    return [tuple(linha) for linha in resultado.all()]


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
    """
    banco = aliased(MovimentoORM)
    conta_do_banco = aliased(ContaORM)
    cartao = aliased(MovimentoORM)
    conta_do_cartao = aliased(ContaORM)

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
    recorrência. Devolve None se o id não existe."""
    recorrencia = await sessao.get(RecorrenciaORM, recorrencia_id)
    if recorrencia is None:
        return None

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
