"""API financeira do Mercúrio.

Nesta etapa inicial, os dados são inteiramente fictícios. Nenhuma
credencial, extrato real ou dado pessoal é usado aqui.
"""

from datetime import date
from decimal import Decimal

from fastapi import FastAPI

from finance_api.domain import (
    ReservaDas,
    ResumoFinanceiro,
    ResumoTitularidade,
    Titularidade,
)

app = FastAPI(
    title="Mercúrio · finance-api",
    description="Resumo financeiro por titularidade e reserva do DAS.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/resumo", response_model=ResumoFinanceiro)
def resumo() -> ResumoFinanceiro:
    """Resumo fictício, no mesmo formato que a API real vai devolver."""
    return ResumoFinanceiro(
        atualizado_em=date(2026, 9, 2),
        titularidades=[
            ResumoTitularidade(
                titularidade=Titularidade.PF,
                nome="Pessoa Física",
                saldo=Decimal("4230.50"),
            ),
            ResumoTitularidade(
                titularidade=Titularidade.PJ,
                nome="Pessoa Jurídica",
                saldo=Decimal("12890.15"),
            ),
            ResumoTitularidade(
                titularidade=Titularidade.MEI,
                nome="MEI",
                saldo=Decimal("980.00"),
            ),
        ],
        reserva_das=ReservaDas(
            referencia="competencia_atual",
            valor_reservado=Decimal("620.00"),
            valor_previsto=Decimal("620.00"),
        ),
    )
