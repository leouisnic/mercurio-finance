"""Um arredondamento só para dinheiro em todo o Mercúrio.

Tudo é calculado com `Decimal` e arredondado uma vez, no fim, para o centavo,
com o meio centavo para cima (`ROUND_HALF_UP`). O `quantize` sem `rounding`
usa o contexto do Python, que leva o meio centavo para o par mais próximo, e a
mesma conta dava um centavo diferente conforme a tela. Um teste reprova
`quantize` fora deste módulo.
"""

from decimal import ROUND_HALF_UP, Decimal

CENTAVO = Decimal("0.01")


def centavos(valor: Decimal) -> Decimal:
    return valor.quantize(CENTAVO, rounding=ROUND_HALF_UP)
