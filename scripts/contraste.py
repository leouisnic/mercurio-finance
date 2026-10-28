"""Mede o contraste dos pares de cor que o painel usa, nos temas claro e escuro.

Lê os tokens de `apps/web/src/app/globals.css` e falha quando um par fica
abaixo do mínimo da WCAG 2.2: 4,5:1 para texto (1.4.3) e 3:1 para o que não é
texto, como barra, ícone e borda de controle (1.4.11).
"""

from __future__ import annotations

import math
import re
import sys
from pathlib import Path

GLOBALS = Path(__file__).resolve().parents[1] / "apps" / "web" / "src" / "app" / "globals.css"

ESCURO = ':root[data-tema="escuro"] {'

TEXTO = 4.5
GRAFICO = 3.0

# (frente, fundo, mínimo): os pares que aparecem de fato nas telas.
PARES = [
    ("tinta", "fundo", TEXTO),
    ("tinta", "superficie", TEXTO),
    ("tinta-2", "superficie", TEXTO),
    ("tinta-2", "superficie-2", TEXTO),
    ("tinta-3", "superficie", TEXTO),
    ("tinta-3", "fundo", TEXTO),
    ("marca", "superficie", TEXTO),
    ("marca", "marca-clara", TEXTO),
    ("marca-escura", "marca-clara", TEXTO),
    ("sobre-cor", "marca", TEXTO),
    ("sobre-cor", "positivo", TEXTO),
    ("sobre-cor", "alerta-forte", TEXTO),
    ("superficie", "tinta", TEXTO),
    ("positivo", "superficie", TEXTO),
    ("positivo", "positivo-fundo", TEXTO),
    ("gasto", "superficie", TEXTO),
    ("gasto", "gasto-fundo", TEXTO),
    ("alerta", "superficie", TEXTO),
    ("alerta", "alerta-fundo", TEXTO),
    ("fixa", "fixa-fundo", TEXTO),
    ("caixinha-texto", "superficie", TEXTO),
    ("caixinha-texto", "superficie-2", TEXTO),
    ("caixinha-texto", "caixinha-fundo", TEXTO),
    ("aviso", "aviso-fundo", TEXTO),
    ("aviso-forte", "aviso-fundo", TEXTO),
    ("marca", "marca-clara", GRAFICO),
    ("positivo-forte", "superficie", GRAFICO),
    ("gasto-forte", "superficie", GRAFICO),
    ("alerta-forte", "superficie", GRAFICO),
    ("caixinha", "superficie", GRAFICO),
]


def oklch_para_srgb(l: float, c: float, h: float) -> tuple[float, float, float]:
    """Converte oklch em sRGB linear recortado, pelas matrizes de Björn Ottosson."""
    a = c * math.cos(math.radians(h))
    b = c * math.sin(math.radians(h))
    l_ = l + 0.3963377774 * a + 0.2158037573 * b
    m_ = l - 0.1055613458 * a - 0.0638541728 * b
    s_ = l - 0.0894841775 * a - 1.2914855480 * b
    l3, m3, s3 = l_**3, m_**3, s_**3
    r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
    g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
    bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3
    return tuple(min(max(v, 0.0), 1.0) for v in (r, g, bl))


def luminancia(linear: tuple[float, float, float]) -> float:
    r, g, b = linear
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(frente: float, fundo: float) -> float:
    claro, escuro = max(frente, fundo), min(frente, fundo)
    return (claro + 0.05) / (escuro + 0.05)


def ler_tokens(css: str) -> dict[str, dict[str, tuple[float, float, float]]]:
    padrao = re.compile(r"--color-([\w-]+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)")
    claro_bloco = css[css.index("@theme") : css.index(ESCURO)]
    escuro_bloco = css[css.index(ESCURO) :]
    temas = {}
    for nome, bloco in (("claro", claro_bloco), ("escuro", escuro_bloco)):
        temas[nome] = {
            token: (float(l) / 100, float(c), float(h)) for token, l, c, h in padrao.findall(bloco)
        }
    # O escuro só redefine o que muda; o resto vem do claro.
    temas["escuro"] = {**temas["claro"], **temas["escuro"]}
    return temas


def main() -> int:
    temas = ler_tokens(GLOBALS.read_text(encoding="utf-8"))
    falhas = 0
    for tema, tokens in temas.items():
        print(f"\nTema {tema}")
        for frente, fundo, minimo in PARES:
            razao = contraste(
                luminancia(oklch_para_srgb(*tokens[frente])), luminancia(oklch_para_srgb(*tokens[fundo]))
            )
            ok = razao >= minimo
            falhas += not ok
            marca = "ok" if ok else "FALHA"
            print(f"  {marca:5} {razao:5.2f}:1 (mín. {minimo}) {frente} sobre {fundo}")
    print(f"\n{falhas} par(es) abaixo do mínimo." if falhas else "\nTodos os pares no mínimo ou acima.")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
