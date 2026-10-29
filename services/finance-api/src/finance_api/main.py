"""API financeira do Mercúrio.

`/resumo` devolve as contas conectadas no Pluggy (nome, tipo, saldo e,
para cartão de crédito, limite/disponível/bandeira/final), lidas direto
da tabela `contas` (ver `finance_api.repositorio`): o mesmo saldo que a
Pluggy relata, atualizado a cada `POST /sync/pluggy`, não uma soma
refeita a partir do histórico de movimentos. `atualizado_em` é a
data/hora real da conta mais recentemente sincronizada. `/movimentos`,
`/movimentos/gastos-diarios` e `/movimentos/por-conta` dão acesso ao
histórico de movimentos já importado. `/ciclos` resolve em datas o ciclo
de pagamento, que depende do calendário de dias não úteis e por isso é
calculado só aqui. `/recorrencias` traz os padrões de
despesa repetida que a detecção sugeriu (sempre pendentes até aprovação
humana) e `/compromissos` guarda as obrigações futuras cadastradas à
mão. Popule o banco local com
`uv run --package finance-api python -m finance_api.seed` (dado
fictício) antes de rodar em desenvolvimento sem Pluggy configurado.

Nenhuma credencial, extrato real ou dado pessoal é usado neste módulo.
"""

from datetime import date
from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import ValidationError
from rq.exceptions import NoSuchJobError
from rq.job import Job
from sqlalchemy.ext.asyncio import AsyncSession

from finance_api.categorias import chave_do_destinatario
from finance_api.centavos import centavos
from finance_api.ciclo import Ciclo, ciclo_anterior, ciclo_de, ciclo_seguinte
from finance_api.compromissos import resumo_parcelas
from finance_api.db import obter_sessao
from finance_api.dinheiro_livre import calcular as calcular_dinheiro_livre
from finance_api.dinheiro_livre import contas_fixas_pendentes
from finance_api.domain import (
    BarraDoCicloOut,
    CategoriaIn,
    CategoriaJaUsada,
    CategoriaOut,
    CategoriaPrincipal,
    CategoriaUpdate,
    CicloOut,
    CiclosOut,
    CompromissoIn,
    CompromissoOut,
    CompromissoUpdate,
    Conta,
    ContaFixaOut,
    ContaUpdate,
    DinheiroLivreOut,
    EstadoPagamentoFatura,
    FluxoDaConta,
    GastoDiario,
    GastoDoDetalhe,
    GastoDoDiaOut,
    GastoMarcado,
    GastoPorCategoria,
    ImpactoOut,
    LoteIn,
    LoteOut,
    MovimentoOut,
    PagamentoFaturaUpdate,
    ParaClassificarOut,
    RecorrenciaOut,
    RecorrenciaUpdate,
    ResumoDaTagOut,
    ResumoFinanceiro,
    StatusCompromisso,
    StatusRecorrencia,
    TagIn,
    TagOut,
    TagsUpdate,
    TagUpdate,
    TotalDoDia,
)
from finance_api.fila import conexao_redis, fila
from finance_api.jobs import job_reimportar_seed, job_sincronizar_pluggy
from finance_api.models import CompromissoORM, ContaORM, MovimentoORM, RecorrenciaORM, TagORM
from finance_api.repositorio import (
    CategoriaInvalida,
    PagamentoFaturaInvalido,
    TagInvalida,
    agregar_despesas_por_dia,
    agregar_fluxo_por_conta,
    apagar_tag,
    atualizar_compromisso,
    atualizar_conta,
    atualizar_recorrencia,
    atualizar_tag,
    contar_para_classificar,
    corrigir_categoria,
    criar_categoria,
    criar_compromisso,
    criar_tag,
    definir_pagamento_de_fatura,
    definir_tags,
    entradas_do_dinheiro_livre,
    gasto_da_categoria,
    gasto_da_tag_por_categoria,
    gastos_da_tag,
    historico_dos_destinatarios,
    listar_categorias,
    listar_compromissos,
    listar_contas,
    listar_movimentos,
    listar_pagamentos_de_fatura,
    listar_recorrencias,
    listar_tags,
    maiores_por_dia,
    marcar_em_lote,
    obter_compromisso,
    tags_dos_movimentos,
    totais_dos_ciclos,
    ultima_sincronizacao,
)
from finance_api.tags import analisar, ciclos_do_impacto

# A fila para classificar cobre seis ciclos, uns três meses: a média por
# categoria usa os ciclos recentes, e movimento mais antigo sem categoria só
# faria o aviso crescer sem mudar número nenhum.
CICLOS_NA_FILA = 6


app = FastAPI(
    title="Mercúrio · finance-api",
    description="Contas conectadas no Pluggy e seus saldos.",
    version="0.1.0",
)


def _recorrencia_out(recorrencia: RecorrenciaORM) -> RecorrenciaOut:
    return RecorrenciaOut(
        id=recorrencia.id,
        conta_id=recorrencia.conta_id,
        descricao=recorrencia.descricao,
        apelido=recorrencia.apelido,
        categoria=recorrencia.categoria,
        valor_medio=recorrencia.valor_medio,
        ocorrencias=recorrencia.ocorrencias,
        primeira_data=recorrencia.primeira_data,
        ultima_data=recorrencia.ultima_data,
        status=recorrencia.status,
        fim_previsto=recorrencia.fim_previsto,
    )


def _inicio_da_fila(hoje: date) -> date:
    ciclo = ciclo_de(hoje)
    for _ in range(CICLOS_NA_FILA - 1):
        ciclo = ciclo_anterior(ciclo)
    return ciclo.inicio


def _movimento_out(
    movimento: MovimentoORM,
    historico: list[tuple[str, int]] | None = None,
    tags: list[str] | None = None,
) -> MovimentoOut:
    return MovimentoOut(
        id=movimento.id,
        conta_id=movimento.conta_id,
        data=movimento.data,
        valor=movimento.valor,
        descricao=movimento.descricao,
        tipo=movimento.tipo,
        proveniencia=movimento.proveniencia,
        categoria=movimento.categoria,
        duplicado_possivel=movimento.duplicado_possivel,
        pagamento_de_fatura=movimento.pagamento_de_fatura,
        categoria_propria=movimento.categoria_propria,
        origem_da_categoria=movimento.origem_da_categoria,
        historico=[CategoriaJaUsada(categoria=categoria, vezes=vezes) for categoria, vezes in historico or []],
        tags=tags or [],
    )


def _compromisso_out(compromisso: CompromissoORM) -> CompromissoOut:
    proxima, total, restantes = resumo_parcelas(
        compromisso.data_inicio,
        compromisso.data_fim,
        date.today(),  # noqa: DTZ011 (data de exibição, sem sensibilidade a fuso)
        ativo=compromisso.status == StatusCompromisso.ATIVO.value,
    )
    return CompromissoOut(
        id=compromisso.id,
        descricao=compromisso.descricao,
        valor_parcela=compromisso.valor_parcela,
        data_inicio=compromisso.data_inicio,
        data_fim=compromisso.data_fim,
        periodicidade=compromisso.periodicidade,
        conta_id=compromisso.conta_id,
        status=compromisso.status,
        proxima_parcela=proxima,
        parcelas_total=total,
        parcelas_restantes=restantes,
        valor_restante=compromisso.valor_parcela * restantes,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/resumo", response_model=ResumoFinanceiro)
async def resumo(
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> ResumoFinanceiro:
    contas = await listar_contas(sessao)
    atualizado_em = await ultima_sincronizacao(sessao)

    return ResumoFinanceiro(
        atualizado_em=atualizado_em,
        contas=[
            Conta(
                id=conta.id,
                nome=conta.nome,
                apelido=conta.apelido,
                tipo=conta.tipo,
                saldo=conta.saldo,
                limite=conta.limite,
                disponivel=conta.disponivel,
                bandeira=conta.bandeira,
                final=conta.final,
                item_id=conta.item_id,
                fechamento=conta.fechamento,
                vencimento=conta.vencimento,
            )
            for conta in contas
        ],
    )


def _conta_out(conta: ContaORM) -> Conta:
    return Conta(
        id=conta.id,
        nome=conta.nome,
        apelido=conta.apelido,
        tipo=conta.tipo,
        saldo=conta.saldo,
        limite=conta.limite,
        disponivel=conta.disponivel,
        bandeira=conta.bandeira,
        final=conta.final,
        item_id=conta.item_id,
        fechamento=conta.fechamento,
        vencimento=conta.vencimento,
    )


@app.patch("/contas/{conta_id}", response_model=Conta)
async def renomear_conta(
    conta_id: str,
    alteracoes: ContaUpdate,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> Conta:
    """Define o apelido da conta, ou o limpa mandando `null`.

    O apelido sobrevive à sincronização: `upsert_contas` não o inclui no
    `ON CONFLICT DO UPDATE`, então a Pluggy nunca sobrescreve a escolha.
    """
    conta = await atualizar_conta(sessao, conta_id, alteracoes.apelido)
    if conta is None:
        raise HTTPException(status_code=404, detail="conta não encontrada")
    return _conta_out(conta)


@app.get("/movimentos", response_model=list[MovimentoOut])
async def movimentos(
    conta_id: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    para_classificar: bool = False,
    tag_id: int | None = None,
    hoje: date | None = None,
    limite: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> list[MovimentoOut]:
    """Lista movimentos já importados, mais recente primeiro. Filtros
    opcionais por conta, por intervalo de data (inclusive nas duas
    pontas) e pelos que esperam categoria; paginação por `limite`/`offset`
    (padrão: 100 por página).

    A fila `para_classificar` começa, sem `data_inicio`, `CICLOS_NA_FILA`
    ciclos antes de `hoje`. Cada movimento dela traz as categorias que o dono
    já deu ao mesmo destinatário, para a tela sugerir primeiro a provável."""
    if para_classificar and data_inicio is None:
        data_inicio = _inicio_da_fila(hoje or date.today())  # noqa: DTZ011 (ciclo é data civil, sem fuso)
    encontrados = await listar_movimentos(
        sessao,
        conta_id=conta_id,
        data_inicio=data_inicio,
        data_fim=data_fim,
        para_classificar=para_classificar,
        tag_id=tag_id,
        limite=limite,
        offset=offset,
    )
    tags = await tags_dos_movimentos(sessao, [movimento.id for movimento in encontrados])
    historico = (
        await historico_dos_destinatarios(
            sessao, {chave_do_destinatario(movimento.descricao) for movimento in encontrados}
        )
        if para_classificar
        else {}
    )
    return [
        _movimento_out(
            movimento,
            historico.get(chave_do_destinatario(movimento.descricao)),
            tags.get(movimento.id),
        )
        for movimento in encontrados
    ]


@app.get("/movimentos/para-classificar", response_model=ParaClassificarOut)
async def para_classificar(
    hoje: date | None = None,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> ParaClassificarOut:
    """Quantas receitas e despesas dos ciclos recentes esperam a categoria
    do dono. `hoje` existe para a demonstração e os testes fixarem a data."""
    desde = _inicio_da_fila(hoje or date.today())  # noqa: DTZ011 (ciclo é data civil, sem fuso)
    return ParaClassificarOut(total=await contar_para_classificar(sessao, desde=desde))


@app.patch("/movimentos/{movimento_id}/categoria", response_model=MovimentoOut)
async def classificar_movimento(
    movimento_id: int,
    escolha: CategoriaUpdate,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> MovimentoOut:
    """Grava a categoria escolhida pelo dono. A escolha vence regra e
    Pluggy e nunca é recalculada."""
    try:
        movimento = await corrigir_categoria(
            sessao, movimento_id, escolha.categoria, todos_do_destinatario=escolha.todos_do_destinatario
        )
    except CategoriaInvalida as erro:
        raise HTTPException(status_code=422, detail=str(erro)) from erro
    if movimento is None:
        raise HTTPException(status_code=404, detail="movimento não encontrado")
    tags = await tags_dos_movimentos(sessao, [movimento.id])
    return _movimento_out(movimento, tags=tags.get(movimento.id))


@app.put("/movimentos/{movimento_id}/tags", response_model=MovimentoOut)
async def marcar_tags(
    movimento_id: int,
    alteracao: TagsUpdate,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> MovimentoOut:
    """Troca as tags do movimento pelas da lista, criando as que não existem.
    Lista vazia tira todas."""
    movimento = await definir_tags(sessao, movimento_id, alteracao.tags)
    if movimento is None:
        raise HTTPException(status_code=404, detail="movimento não encontrado")
    tags = await tags_dos_movimentos(sessao, [movimento.id])
    return _movimento_out(movimento, tags=tags.get(movimento.id))


@app.post("/movimentos/lote", response_model=LoteOut)
async def marcar_varios(
    lote: LoteIn,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> LoteOut:
    """A mesma categoria ou a mesma tag para vários movimentos. A categoria vale
    só para eles, sem virar regra; a tag se soma às que já tinham."""
    try:
        alterados = await marcar_em_lote(sessao, lote.ids, categoria=lote.categoria, tag=lote.tag)
    except CategoriaInvalida as erro:
        raise HTTPException(status_code=422, detail=str(erro)) from erro
    return LoteOut(alterados=alterados)


def _tag_out(tag: TagORM, gasto=Decimal(0), quantidade=0, primeira=None, ultima=None) -> TagOut:
    return TagOut(
        id=tag.id,
        nome=tag.nome,
        icone=tag.icone,
        cor=tag.cor,
        teto=tag.teto,
        inicio=tag.inicio,
        fim=tag.fim,
        arquivada=tag.arquivada,
        gasto=gasto,
        quantidade=quantidade,
        primeira_data=primeira,
        ultima_data=ultima,
    )


@app.get("/tags", response_model=list[TagOut])
async def tags(
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> list[TagOut]:
    """As tags com quanto se gastou em cada uma. A tag só agrupa: não muda
    nenhum outro número."""
    return [_tag_out(*linha) for linha in await listar_tags(sessao)]


@app.post("/tags", response_model=TagOut, status_code=201)
async def nova_tag(
    tag: TagIn,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> TagOut:
    """Tag criada antes de ter movimento, com teto e período opcionais."""
    try:
        criada = await criar_tag(sessao, tag.model_dump())
    except TagInvalida as erro:
        raise HTTPException(status_code=422, detail=str(erro)) from erro
    return _tag_out(criada)


@app.patch("/tags/{tag_id}", response_model=TagOut)
async def editar_tag(
    tag_id: int,
    alteracoes: TagUpdate,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> TagOut:
    """Renomeia, troca a aparência, o teto ou o período, ou arquiva."""
    try:
        tag = await atualizar_tag(sessao, tag_id, alteracoes.model_dump(exclude_unset=True))
    except TagInvalida as erro:
        raise HTTPException(status_code=422, detail=str(erro)) from erro
    if tag is None:
        raise HTTPException(status_code=404, detail="tag não encontrada")
    linha = next(linha for linha in await listar_tags(sessao) if linha[0].id == tag_id)
    return _tag_out(*linha)


@app.delete("/tags/{tag_id}", status_code=204)
async def remover_tag(
    tag_id: int,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> None:
    """Os movimentos ficam; só perdem a tag."""
    if not await apagar_tag(sessao, tag_id):
        raise HTTPException(status_code=404, detail="tag não encontrada")


@app.get("/tags/{tag_id}", response_model=ResumoDaTagOut)
async def resumo_da_tag(
    tag_id: int,
    hoje: date | None = None,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> ResumoDaTagOut:
    """Quanto a tag custou, onde pesou e o impacto no orçamento, como em
    `finance_api.tags`. `hoje` existe para a demonstração e os testes."""
    linha = next((linha for linha in await listar_tags(sessao) if linha[0].id == tag_id), None)
    if linha is None:
        raise HTTPException(status_code=404, detail="tag não encontrada")
    dia = hoje or date.today()  # noqa: DTZ011 (ciclo é data civil, sem fuso)
    gastos = await gastos_da_tag(sessao, tag_id)
    ciclos = ciclos_do_impacto(gastos)
    totais = await totais_dos_ciclos(sessao, ciclos[1] if ciclos else [])
    analise = analisar(gastos, totais=totais, hoje=dia)
    por_categoria = await gasto_da_tag_por_categoria(sessao, tag_id)

    principal = None
    if analise.categoria_principal:
        categoria, total = analise.categoria_principal
        comparacao = [c for c in (ciclos[1] if ciclos else []) if c.fim < ciclos[0].inicio and c in totais]
        tipico = None
        if comparacao:
            soma = await gasto_da_categoria(
                sessao, categoria, inicio=comparacao[0].inicio, fim=comparacao[-1].fim
            )
            tipico = centavos(soma / len(comparacao))
        principal = CategoriaPrincipal(categoria=categoria, total=total, tipico_por_ciclo=tipico)

    impacto = analise.impacto
    return ResumoDaTagOut(
        **_tag_out(*linha).model_dump(),
        por_categoria=[GastoPorCategoria(categoria=c, total=t) for c, t in por_categoria],
        dias=analise.dias,
        por_dia=analise.por_dia,
        maiores=[GastoMarcado(data=g.data, descricao=g.descricao, valor=g.valor) for g in analise.maiores],
        dia_mais_caro=TotalDoDia(data=analise.dia_mais_caro[0], total=analise.dia_mais_caro[1])
        if analise.dia_mais_caro
        else None,
        acumulado=[TotalDoDia(data=d, total=t) for d, t in analise.acumulado],
        categoria_principal=principal,
        impacto=ImpactoOut(
            ciclo=_ciclo_out(impacto.ciclo),
            gasto=impacto.gasto,
            tipico=impacto.tipico,
            rombo=impacto.rombo,
            rombo_da_tag=impacto.rombo_da_tag,
            sobra_media=impacto.sobra_media,
            ciclos_para_recuperar=impacto.ciclos_para_recuperar,
            barras=[
                BarraDoCicloOut(
                    ciclo=_ciclo_out(b.ciclo), gasto_sem_a_tag=b.gasto_sem_a_tag, gasto_da_tag=b.gasto_da_tag
                )
                for b in impacto.barras
            ],
        )
        if impacto
        else None,
    )


@app.post("/categorias", response_model=CategoriaOut, status_code=201)
async def nova_categoria(
    categoria: CategoriaIn,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> CategoriaOut:
    """Categoria criada pelo dono, no fim da lista."""
    try:
        criada = await criar_categoria(sessao, categoria.nome, categoria.icone, categoria.cor)
    except CategoriaInvalida as erro:
        raise HTTPException(status_code=422, detail=str(erro)) from erro
    return CategoriaOut(id=criada.id, nome=criada.nome, icone=criada.icone, cor=criada.cor)


@app.get("/categorias", response_model=list[CategoriaOut])
async def categorias(
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> list[CategoriaOut]:
    return [CategoriaOut(id=categoria.id, nome=categoria.nome, icone=categoria.icone, cor=categoria.cor) for categoria in await listar_categorias(sessao)]


@app.get("/movimentos/pagamentos-de-fatura", response_model=list[MovimentoOut])
async def pagamentos_de_fatura(
    estado: EstadoPagamentoFatura | None = None,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> list[MovimentoOut]:
    """Saídas da conta corrente que o Mercúrio concluiu serem pagamento da
    fatura de um cartão (e por isso não contam como gasto, já que a
    compra no cartão já foi contada). Serve para revisar: o que estiver
    errado aqui você corrige em `PATCH /movimentos/{id}/pagamento-de-fatura`."""
    encontrados = await listar_pagamentos_de_fatura(
        sessao, estado=estado.value if estado is not None else None
    )
    return [_movimento_out(movimento) for movimento in encontrados]


@app.patch("/movimentos/{movimento_id}/pagamento-de-fatura", response_model=MovimentoOut)
async def revisar_pagamento_de_fatura(
    movimento_id: int,
    revisao: PagamentoFaturaUpdate,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> MovimentoOut:
    """Corrige a conclusão do Mercúrio nos dois sentidos: `descartado` para
    um que ele marcou errado (volta a contar como gasto), `confirmado` para
    um pagamento de fatura que ele não detectou sozinho."""
    try:
        movimento = await definir_pagamento_de_fatura(sessao, movimento_id, revisao.estado.value)
    except PagamentoFaturaInvalido as erro:
        raise HTTPException(status_code=422, detail=str(erro)) from erro
    if movimento is None:
        raise HTTPException(status_code=404, detail="movimento não encontrado")
    return _movimento_out(movimento)


@app.get("/movimentos/gastos-diarios", response_model=list[GastoDiario])
async def gastos_diarios(
    data_inicio: date,
    data_fim: date,
    conta_id: str | None = None,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> list[GastoDiario]:
    """Soma as despesas (`tipo == despesa`) de cada dia no intervalo
    pedido (inclusive nas duas pontas). Pagamento de fatura fica fora."""
    linhas = await agregar_despesas_por_dia(
        sessao, data_inicio=data_inicio, data_fim=data_fim, conta_id=conta_id
    )
    maiores = await maiores_por_dia(sessao, inicio=data_inicio, fim=data_fim, conta_id=conta_id)
    return [
        GastoDiario(
            data=data,
            total=total,
            em_revisao=em_revisao,
            maiores=[GastoDoDetalhe(descricao=d, valor=v) for d, v in maiores.get(data, [])],
        )
        for data, total, em_revisao in linhas
    ]


@app.get("/movimentos/por-conta", response_model=list[FluxoDaConta])
async def fluxo_por_conta(
    data_inicio: date,
    data_fim: date,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> list[FluxoDaConta]:
    """Entradas e saídas de cada conta no intervalo (inclusive nas duas
    pontas). Conta sem movimento no período aparece zerada."""
    linhas = await agregar_fluxo_por_conta(sessao, data_inicio=data_inicio, data_fim=data_fim)
    return [
        FluxoDaConta(
            conta_id=conta_id,
            nome=nome,
            apelido=apelido,
            tipo=tipo,
            entradas=entradas,
            saidas=saidas,
            em_revisao=em_revisao,
            fatura_paga=fatura_paga,
            transferencias_entrada=transferencias_entrada,
            transferencias_saida=transferencias_saida,
        )
        for (
            conta_id,
            nome,
            apelido,
            tipo,
            entradas,
            saidas,
            em_revisao,
            fatura_paga,
            transferencias_entrada,
            transferencias_saida,
        ) in linhas
    ]


def _ciclo_out(ciclo: Ciclo) -> CicloOut:
    return CicloOut(numero=ciclo.numero, inicio=ciclo.inicio, fim=ciclo.fim)


@app.get("/ciclos", response_model=CiclosOut)
def ciclos(referencia: date | None = None) -> CiclosOut:
    """O ciclo de pagamento que contém `referencia` (hoje, se omitida),
    mais o anterior e o seguinte.

    O painel não calcula ciclo: a regra depende do calendário de dias não
    úteis (ver `finance_api.ciclo`) e mora num lugar só.
    """
    atual = ciclo_de(referencia or date.today())  # noqa: DTZ011 (ciclo é data civil, sem fuso)
    return CiclosOut(
        atual=_ciclo_out(atual),
        anterior=_ciclo_out(ciclo_anterior(atual)),
        seguinte=_ciclo_out(ciclo_seguinte(atual)),
    )


@app.get("/dinheiro-livre", response_model=DinheiroLivreOut)
async def dinheiro_livre(
    hoje: date | None = None,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> DinheiroLivreOut:
    """Quanto dá para gastar até a véspera do próximo pagamento, com a conta
    item por item, a cota do dia e o cofrinho. `hoje` existe para a
    demonstração e os testes fixarem a data."""
    dia = hoje or date.today()  # noqa: DTZ011 (ciclo é data civil, sem fuso)
    ciclo = ciclo_de(dia)
    saldo, cartao, recorrencias, compromissos, gastos = await entradas_do_dinheiro_livre(
        sessao, inicio=ciclo.inicio, hoje=dia
    )
    maiores = await maiores_por_dia(sessao, inicio=ciclo.inicio, fim=dia, sem_conta_fixa=True)
    resultado = calcular_dinheiro_livre(
        hoje=dia,
        inicio=ciclo.inicio,
        fim=ciclo.fim,
        saldo_contas=saldo,
        cartao_usado=cartao,
        contas_fixas=contas_fixas_pendentes(
            recorrencias, compromissos, hoje=dia, inicio=ciclo.inicio, fim=ciclo.fim
        ),
        gastos_por_dia=gastos,
    )
    return DinheiroLivreOut(
        hoje=dia,
        ciclo=_ciclo_out(ciclo),
        ciclo_seguinte=_ciclo_out(ciclo_seguinte(ciclo)),
        saldo_contas=resultado.saldo_contas,
        cartao_usado=resultado.cartao_usado,
        contas_fixas=[ContaFixaOut(**vars(conta)) for conta in resultado.contas_fixas],
        contas_fixas_total=resultado.contas_fixas_total,
        caixinha=resultado.caixinha,
        livre=resultado.livre,
        dias_do_ciclo=resultado.dias_do_ciclo,
        dias_restantes=resultado.dias_restantes,
        cota_do_dia=resultado.cota_do_dia,
        cofrinho=resultado.cofrinho,
        gasto_hoje=resultado.gasto_hoje,
        hoje_disponivel=resultado.hoje_disponivel,
        gastos_por_dia=[
            GastoDoDiaOut(
                data=data,
                total=total,
                maiores=[GastoDoDetalhe(descricao=d, valor=v) for d, v in maiores.get(data, [])],
            )
            for data, total in resultado.gastos_por_dia.items()
        ],
    )


@app.get("/recorrencias", response_model=list[RecorrenciaOut])
async def recorrencias(
    status: StatusRecorrencia | None = None,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> list[RecorrenciaOut]:
    """Padrões de despesa repetida encontrados no histórico, mais recente
    primeiro. Toda candidata nasce `pendente`: a detecção sugere, quem
    decide é você (`/aprovar` ou `/rejeitar`)."""
    encontradas = await listar_recorrencias(
        sessao, status=status.value if status is not None else None
    )
    return [_recorrencia_out(recorrencia) for recorrencia in encontradas]


@app.post("/recorrencias/{recorrencia_id}/aprovar", response_model=RecorrenciaOut)
async def aprovar_recorrencia(
    recorrencia_id: int,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> RecorrenciaOut:
    recorrencia = await atualizar_recorrencia(
        sessao, recorrencia_id, {"status": StatusRecorrencia.APROVADA.value}
    )
    if recorrencia is None:
        raise HTTPException(status_code=404, detail="recorrência não encontrada")
    return _recorrencia_out(recorrencia)


@app.post("/recorrencias/{recorrencia_id}/rejeitar", response_model=RecorrenciaOut)
async def rejeitar_recorrencia(
    recorrencia_id: int,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> RecorrenciaOut:
    """Rejeitar é definitivo em relação à detecção: a sincronização
    seguinte reencontra o mesmo padrão, mas não devolve essa recorrência
    para a fila (ver `salvar_recorrencias_detectadas`)."""
    recorrencia = await atualizar_recorrencia(
        sessao, recorrencia_id, {"status": StatusRecorrencia.REJEITADA.value}
    )
    if recorrencia is None:
        raise HTTPException(status_code=404, detail="recorrência não encontrada")
    return _recorrencia_out(recorrencia)


@app.patch("/recorrencias/{recorrencia_id}", response_model=RecorrenciaOut)
async def classificar_recorrencia(
    recorrencia_id: int,
    alteracoes: RecorrenciaUpdate,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> RecorrenciaOut:
    """Dá nome e categoria à recorrência, e opcionalmente já decide o
    status na mesma chamada.

    A descrição bancária nem sempre informa a finalidade. O apelido e a
    categoria pessoal tornam a classificação útil sem alterar o dado original.
    """
    campos = alteracoes.model_dump(exclude_unset=True)
    if not campos:
        recorrencia = await atualizar_recorrencia(sessao, recorrencia_id, {})
    else:
        recorrencia = await atualizar_recorrencia(
            sessao,
            recorrencia_id,
            {
                nome: (valor.value if hasattr(valor, "value") else valor)
                for nome, valor in campos.items()
            },
        )
    if recorrencia is None:
        raise HTTPException(status_code=404, detail="recorrência não encontrada")
    return _recorrencia_out(recorrencia)


@app.post("/compromissos", response_model=CompromissoOut, status_code=201)
async def cadastrar_compromisso(
    compromisso: CompromissoIn,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> CompromissoOut:
    """Cadastra uma obrigação futura (ex: pagar alguém em N vezes).
    `data_fim` é obrigatória: compromisso tem prazo para acabar."""
    criado = await criar_compromisso(sessao, compromisso.model_dump())
    return _compromisso_out(criado)


@app.get("/compromissos", response_model=list[CompromissoOut])
async def compromissos(
    status: StatusCompromisso | None = None,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> list[CompromissoOut]:
    """Compromissos cadastrados, com a projeção de parcelas calculada.
    É planejamento: nenhuma parcela é conciliada automaticamente contra
    os movimentos reais (ver docs/decisions.md)."""
    encontrados = await listar_compromissos(
        sessao, status=status.value if status is not None else None
    )
    return [_compromisso_out(compromisso) for compromisso in encontrados]


@app.patch("/compromissos/{compromisso_id}", response_model=CompromissoOut)
async def editar_compromisso(
    compromisso_id: int,
    alteracoes: CompromissoUpdate,
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> CompromissoOut:
    """Edita um compromisso ou muda o status (quitar/cancelar à mão).
    Campo não enviado fica como está."""
    compromisso = await obter_compromisso(sessao, compromisso_id)
    if compromisso is None:
        raise HTTPException(status_code=404, detail="compromisso não encontrado")

    campos = alteracoes.model_dump(exclude_unset=True)
    if not campos:
        return _compromisso_out(compromisso)

    novo_status = campos.pop("status", None)
    if campos:
        # Revalida o compromisso inteiro já com a mudança aplicada, para o
        # PATCH não conseguir criar um estado que o POST rejeitaria (data
        # de fim antes do início, valor de parcela negativo).
        atual = {
            "descricao": compromisso.descricao,
            "valor_parcela": compromisso.valor_parcela,
            "data_inicio": compromisso.data_inicio,
            "data_fim": compromisso.data_fim,
            "periodicidade": compromisso.periodicidade,
            "conta_id": compromisso.conta_id,
        }
        try:
            validado = CompromissoIn(**{**atual, **campos})
        except ValidationError as erro:
            # Só tipo/campo/mensagem: o input cru traz Decimal e o contexto
            # traz a exceção original, nenhum dos dois serializa em JSON.
            detalhe = erro.errors(include_url=False, include_input=False, include_context=False)
            raise HTTPException(status_code=422, detail=detalhe) from erro
        campos = validado.model_dump()

    if novo_status is not None:
        campos["status"] = novo_status.value

    atualizado = await atualizar_compromisso(sessao, compromisso, campos)
    return _compromisso_out(atualizado)


@app.post("/sync/seed", status_code=202)
def sincronizar_seed() -> dict[str, str]:
    """Enfileira a reimportação do extrato fictício, sem travar a resposta.

    Existe para provar a fila do Redis de ponta a ponta antes do job real
    do Pluggy; é seguro rodar mais de uma vez, a importação é idempotente.
    Consulte o resultado em GET /sync/{job_id}.
    """
    job = fila.enqueue(job_reimportar_seed)
    return {"job_id": job.id, "status": job.get_status()}


@app.post("/sync/pluggy", status_code=202)
def sincronizar_pluggy() -> dict[str, str]:
    """Enfileira a sincronização real com o Pluggy (todos os bancos em
    `PLUGGY_ITEM_IDS`), sem travar a resposta. Só leitura na Pluggy;
    escrita no Postgres é idempotente. Consulte o resultado em
    GET /sync/{job_id}.
    """
    job = fila.enqueue(job_sincronizar_pluggy, job_timeout=300)
    return {"job_id": job.id, "status": job.get_status()}


@app.get("/sync/{job_id}")
def status_sincronizacao(job_id: str) -> dict[str, object]:
    try:
        job = Job.fetch(job_id, connection=conexao_redis)
    except NoSuchJobError as erro:
        raise HTTPException(status_code=404, detail="job não encontrado") from erro

    return {
        "job_id": job.id,
        "status": job.get_status(),
        "resultado": job.return_value(),
    }
