"""Dinheiro arredonda num lugar só, com o meio centavo para cima."""

from decimal import Decimal
from pathlib import Path

from finance_api.centavos import centavos

FONTE = Path(__file__).resolve().parents[1] / "src" / "finance_api"


def test_meio_centavo_vai_para_cima() -> None:
    assert centavos(Decimal("0.005")) == Decimal("0.01")
    assert centavos(Decimal("2.345")) == Decimal("2.35")
    assert centavos(Decimal("2.344")) == Decimal("2.34")


def test_nenhum_modulo_arredonda_dinheiro_por_conta_propria() -> None:
    """`quantize` fora de `centavos.py` volta a misturar regras de
    arredondamento e a mesma conta dá um centavo diferente em cada tela."""
    fora = [
        caminho.name
        for caminho in FONTE.rglob("*.py")
        if caminho.name != "centavos.py" and ".quantize(" in caminho.read_text(encoding="utf-8")
    ]

    assert fora == []
