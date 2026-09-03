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
    PLUGGY_ITEM_ID_MERCADOPAGO,
    PLUGGY_ITEM_ID_NUBANK,
)

# As duas contas conectadas hoje são PF (Nubank e Mercado Pago). A PJ
# existe (Nubank, CNPJ do MEI) mas não está conectada no Pluggy: é só
# intermediária para receber nota fiscal, sempre com saldo perto de zero.
# Ver docs/domain-rules.md. Adicionar aqui se um dia ela for conectada.
CONTAS_PLUGGY = [
    (PLUGGY_ITEM_ID_NUBANK, "pf"),
    (PLUGGY_ITEM_ID_MERCADOPAGO, "pf"),
]
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
    """Busca transações reais no Pluggy (hoje, Nubank e Mercado Pago,
    as duas PF, ver `CONTAS_PLUGGY`) e grava no Postgres. Só leitura na
    Pluggy; idempotente na escrita (reimportar não duplica saldo).

    Inclui conta corrente e cartão de crédito de cada titularidade: sem
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

    if not (PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET) or not all(
        item_id for item_id, _ in CONTAS_PLUGGY
    ):
        raise RuntimeError(
            "Credenciais do Pluggy não configuradas (PLUGGY_CLIENT_ID, "
            "PLUGGY_CLIENT_SECRET, PLUGGY_ITEM_ID_NUBANK, "
            "PLUGGY_ITEM_ID_MERCADOPAGO)."
        )

    api_key = autenticar(PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET)

    movimentos: list[dict] = []
    contas_processadas = 0
    for item_id, titularidade in CONTAS_PLUGGY:
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
