"""API financeira do Mercúrio.

Nesta etapa, `/resumo` calcula o saldo por titularidade a partir de um
extrato fictício versionado (`dados/extrato_ficticio.csv`), usando o
mesmo importador e a mesma regra de agregação do `ingestion-worker`. A
reserva do DAS continua um valor fixo provisório: a regra real de
cálculo ainda depende de uma decisão de negócio do Leonardo (percentual
da receita, valor fixo configurável, etc), não é só um detalhe técnico.
Nenhuma credencial, extrato real ou dado pessoal é usado aqui.
"""

from datetime import date
from decimal import Decimal
from pathlib import Path

from fastapi import FastAPI
from ingestion_worker.extrato import carregar_extrato, resumir_por_titularidade

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

EXTRATO_FICTICIO = Path(__file__).parent / "dados" / "extrato_ficticio.csv"

NOME_POR_TITULARIDADE = {
    Titularidade.PF: "Pessoa Física",
    Titularidade.PJ: "Pessoa Jurídica",
    Titularidade.MEI: "MEI",
}

# Provisório: sem regra real de cálculo ainda. Ver docs/decisions.md.
RESERVA_DAS_FICTICIA = ReservaDas(
    referencia="competencia_atual",
    valor_reservado=Decimal("620.00"),
    valor_previsto=Decimal("650.00"),
)


def _saldo_em_decimal(total: float) -> Decimal:
    """Converte o total (float, vindo do pandas) para Decimal com 2 casas
    fixas. `round()` sozinho não garante isso: `round(2550.0, 2)` continua
    `2550.0`, que vira `"2550.0"` em vez de `"2550.00"` na API."""
    return Decimal(str(total)).quantize(Decimal("0.01"))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/resumo", response_model=ResumoFinanceiro)
def resumo() -> ResumoFinanceiro:
    extrato = carregar_extrato(EXTRATO_FICTICIO)
    totais = resumir_por_titularidade(extrato).set_index("titularidade")["total"]

    titularidades = [
        ResumoTitularidade(
            titularidade=titularidade,
            nome=NOME_POR_TITULARIDADE[titularidade],
            saldo=_saldo_em_decimal(totais.get(titularidade.value, 0.0)),
        )
        for titularidade in Titularidade
    ]

    return ResumoFinanceiro(
        atualizado_em=date(2026, 8, 15),
        titularidades=titularidades,
        reserva_das=RESERVA_DAS_FICTICIA,
    )
