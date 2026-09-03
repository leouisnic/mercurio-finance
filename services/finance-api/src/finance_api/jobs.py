"""Jobs processados pelo worker RQ, em outro processo.

Cada job cria sua própria sessão do banco: roda num processo separado do
`finance-api`, não pode compartilhar o engine em memória do processo web.
"""

import asyncio

import pandas as pd
from mercurio_domain import Proveniencia

from finance_api.config import PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_ITEM_IDS
from finance_api.db import async_session
from finance_api.repositorio import inserir_movimentos, upsert_contas
from finance_api.seed import EXTRATO_FICTICIO, seed_contas_ficticias


def job_reimportar_seed() -> int:
    """Job de exemplo para provar a fila de ponta a ponta antes de plugar o
    Pluggy de verdade (Fase B). Reimporta o extrato fictício; idempotente,
    então rodar de novo não duplica saldo."""
    from ingestion_worker.extrato import carregar_extrato

    extrato = carregar_extrato(EXTRATO_FICTICIO)

    async def inserir() -> int:
        async with async_session() as sessao:
            await upsert_contas(sessao, seed_contas_ficticias())
            return await inserir_movimentos(
                sessao, extrato, proveniencia=Proveniencia.IMPORTACAO_MANUAL.value
            )

    return asyncio.run(inserir())


def job_sincronizar_pluggy() -> dict[str, int]:
    """Busca contas e transações reais no Pluggy (um item por banco
    conectado, `PLUGGY_ITEM_IDS`) e grava no Postgres. Só leitura na
    Pluggy; idempotente na escrita (reimportar não duplica saldo, e
    atualizar uma conta que já existe só atualiza saldo/limite).

    Inclui conta corrente e cartão de crédito de cada banco: sem separar
    o pagamento da fatura do cartão da compra em si ainda, então pode
    haver dupla contagem entre "compra no cartão" e "pagamento da
    fatura" no histórico de movimentos (decisão registrada em
    docs/decisions.md). O saldo mostrado no painel não depende disso: vem
    direto do que a Pluggy relata para cada conta, não de somar
    movimentos.
    """
    from ingestion_worker.extrato import processar_movimentos
    from ingestion_worker.pluggy import (
        autenticar,
        listar_contas,
        listar_transacoes,
        mapear_conta,
        mapear_para_movimento,
    )

    if not (PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET and PLUGGY_ITEM_IDS):
        raise RuntimeError(
            "Credenciais do Pluggy não configuradas (PLUGGY_CLIENT_ID, "
            "PLUGGY_CLIENT_SECRET, PLUGGY_ITEM_IDS)."
        )

    api_key = autenticar(PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET)

    contas: list[dict] = []
    movimentos: list[dict] = []
    for item_id in PLUGGY_ITEM_IDS:
        for conta in listar_contas(api_key, item_id):
            contas.append(mapear_conta(conta))
            for transacao in listar_transacoes(api_key, conta["id"]):
                movimentos.append(mapear_para_movimento(transacao))

    async def gravar() -> int:
        async with async_session() as sessao:
            await upsert_contas(sessao, contas)
            if not movimentos:
                return 0
            extrato = processar_movimentos(pd.DataFrame(movimentos))
            return await inserir_movimentos(sessao, extrato, proveniencia=Proveniencia.PLUGGY.value)

    inseridos = asyncio.run(gravar())
    return {
        "contas": len(contas),
        "transacoes_encontradas": len(movimentos),
        "inseridos": inseridos,
    }
