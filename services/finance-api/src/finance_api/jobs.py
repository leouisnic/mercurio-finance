"""Jobs processados pelo worker RQ, em outro processo.

Cada job cria sua própria sessão do banco: roda num processo separado do
`finance-api`, não pode compartilhar o engine em memória do processo web.
"""

import asyncio

from mercurio_domain import Proveniencia

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
