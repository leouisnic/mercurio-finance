"""Popula o Postgres local com o extrato fictício, só para desenvolvimento.

Uso: uv run --package finance-api python -m finance_api.seed
"""

import asyncio
from pathlib import Path

from ingestion_worker.extrato import carregar_extrato
from mercurio_domain import Proveniencia

from finance_api.db import async_session
from finance_api.repositorio import inserir_movimentos

EXTRATO_FICTICIO = Path(__file__).parent / "dados" / "extrato_ficticio.csv"


async def semear() -> None:
    extrato = carregar_extrato(EXTRATO_FICTICIO)
    async with async_session() as sessao:
        inseridos = await inserir_movimentos(
            sessao, extrato, proveniencia=Proveniencia.IMPORTACAO_MANUAL.value
        )
    print(f"{inseridos} movimentos inseridos (fictícios, de {EXTRATO_FICTICIO.name}).")


if __name__ == "__main__":
    asyncio.run(semear())
