"""Jobs processados pelo worker RQ, em outro processo.

Cada job cria sua própria sessão do banco: roda num processo separado do
`finance-api`, não pode compartilhar o engine em memória do processo web.
"""

import asyncio

import pandas as pd
from mercurio_domain import Proveniencia

from finance_api.config import (
    PLUGGY_CLIENT_ID,
    PLUGGY_CLIENT_SECRET,
    PLUGGY_ITEM_ID_PF,
    PLUGGY_ITEM_ID_PJ,
)
from finance_api.db import async_session
from finance_api.repositorio import inserir_movimentos
from finance_api.seed import EXTRATO_FICTICIO


def job_reimportar_seed() -> int:
    """Job de exemplo para provar a fila de ponta a ponta antes de plugar o
    Pluggy de verdade (Fase B). Reimporta o extrato fictício; idempotente,
    então rodar de novo não duplica saldo."""
    from ingestion_worker.extrato import carregar_extrato

    extrato = carregar_extrato(EXTRATO_FICTICIO)

    async def inserir() -> int:
        async with async_session() as sessao:
            return await inserir_movimentos(
                sessao, extrato, proveniencia=Proveniencia.IMPORTACAO_MANUAL.value
            )

    return asyncio.run(inserir())


def job_sincronizar_pluggy() -> dict[str, int]:
    """Busca transações reais no Pluggy (Nubank = PJ, Mercado Pago = PF) e
    grava no Postgres. Só leitura na Pluggy; idempotente na escrita
    (reimportar não duplica saldo).

    Inclui conta corrente e cartão de crédito das duas titularidades: sem
    separar o pagamento da fatura do cartão da compra em si ainda, então
    pode haver dupla contagem entre "compra no cartão" e "pagamento da
    fatura" até essa regra ser desenhada. Decisão registrada em
    docs/decisions.md.
    """
    from ingestion_worker.extrato import processar_movimentos
    from ingestion_worker.pluggy import (
        autenticar,
        listar_contas,
        listar_transacoes,
        mapear_para_movimento,
    )

    if not (PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET and PLUGGY_ITEM_ID_PJ and PLUGGY_ITEM_ID_PF):
        raise RuntimeError(
            "Credenciais do Pluggy não configuradas (PLUGGY_CLIENT_ID, "
            "PLUGGY_CLIENT_SECRET, PLUGGY_ITEM_ID_PJ, PLUGGY_ITEM_ID_PF)."
        )

    api_key = autenticar(PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET)

    movimentos: list[dict] = []
    contas_processadas = 0
    for item_id, titularidade in [(PLUGGY_ITEM_ID_PJ, "pj"), (PLUGGY_ITEM_ID_PF, "pf")]:
        for conta in listar_contas(api_key, item_id):
            contas_processadas += 1
            for transacao in listar_transacoes(api_key, conta["id"]):
                movimentos.append(mapear_para_movimento(transacao, titularidade))

    if not movimentos:
        return {"contas": contas_processadas, "transacoes_encontradas": 0, "inseridos": 0}

    extrato = processar_movimentos(pd.DataFrame(movimentos))

    async def inserir() -> int:
        async with async_session() as sessao:
            return await inserir_movimentos(sessao, extrato, proveniencia=Proveniencia.PLUGGY.value)

    inseridos = asyncio.run(inserir())
    return {
        "contas": contas_processadas,
        "transacoes_encontradas": len(movimentos),
        "inseridos": inseridos,
    }
