"""Popula o Postgres local com contas e extrato fictícios, só para
desenvolvimento e para os testes automatizados (e2e do apps/web).

Uso: uv run --package finance-api python -m finance_api.seed
"""

import asyncio
from pathlib import Path

from ingestion_worker.extrato import carregar_extrato
from mercurio_domain import Proveniencia

from finance_api.db import async_session
from finance_api.repositorio import inserir_movimentos, upsert_contas

EXTRATO_FICTICIO = Path(__file__).parent / "dados" / "extrato_ficticio.csv"


def seed_contas_ficticias() -> list[dict]:
    """As duas contas fictícias que `extrato_ficticio.csv` referencia.
    Precisam existir antes dos movimentos (chave estrangeira)."""
    return [
        {"id": "conta-a", "nome": "Conta A (fictícia)", "tipo": "BANK", "saldo": 2898.40},
        {"id": "conta-b", "nome": "Conta B (fictícia)", "tipo": "BANK", "saldo": 254.50},
    ]


async def semear() -> None:
    extrato = carregar_extrato(EXTRATO_FICTICIO)
    async with async_session() as sessao:
        await upsert_contas(sessao, seed_contas_ficticias())
        inseridos = await inserir_movimentos(
            sessao, extrato, proveniencia=Proveniencia.IMPORTACAO_MANUAL.value
        )
    print(f"{inseridos} movimentos inseridos (fictícios, de {EXTRATO_FICTICIO.name}).")


if __name__ == "__main__":
    asyncio.run(semear())
