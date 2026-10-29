"""Quanto uma tag custou e quanto pesou no orçamento. Lógica pura, sem banco.

O impacto compara o ciclo em que a tag mais gastou com o típico: a média dos
`CICLOS_DE_COMPARACAO` ciclos anteriores. Rombo é quanto o ciclo passou do
típico; a parte da tag é esse rombo limitado ao que a tag gastou no ciclo,
porque o resto do excesso veio de outra coisa. Recupera em divide a parte da
tag pelo que sobrou, em média, nesses mesmos ciclos. Sem ciclo anterior com dado, não há típico e o impacto fica de
fora: comparar com nada inventaria um número.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from finance_api.centavos import centavos as _centavos
from finance_api.ciclo import Ciclo, ciclo_anterior, ciclo_de, ciclo_seguinte

CICLOS_DE_COMPARACAO = 3
MAIORES = 5


@dataclass(frozen=True)
class GastoDaTag:
    data: date
    valor: Decimal
    descricao: str
    categoria: str | None


@dataclass(frozen=True)
class TotaisDoCiclo:
    gasto: Decimal
    entrou: Decimal


@dataclass(frozen=True)
class BarraDoCiclo:
    ciclo: Ciclo
    gasto_sem_a_tag: Decimal
    gasto_da_tag: Decimal


@dataclass(frozen=True)
class Impacto:
    ciclo: Ciclo
    gasto: Decimal
    tipico: Decimal
    rombo: Decimal
    rombo_da_tag: Decimal
    sobra_media: Decimal
    ciclos_para_recuperar: int | None
    barras: list[BarraDoCiclo]


@dataclass(frozen=True)
class Analise:
    total: Decimal
    dias: int
    por_dia: Decimal
    maiores: list[GastoDaTag]
    dia_mais_caro: tuple[date, Decimal] | None
    acumulado: list[tuple[date, Decimal]]
    categoria_principal: tuple[str, Decimal] | None
    impacto: Impacto | None


def ciclos_do_impacto(gastos: list[GastoDaTag]) -> tuple[Ciclo, list[Ciclo]] | None:
    """O ciclo em que a tag mais gastou e os que entram no gráfico: os de
    comparação antes dele, ele e o seguinte."""
    if not gastos:
        return None
    por_ciclo: dict[Ciclo, Decimal] = defaultdict(Decimal)
    for gasto in gastos:
        por_ciclo[ciclo_de(gasto.data)] += gasto.valor
    principal = max(por_ciclo, key=lambda ciclo: (por_ciclo[ciclo], ciclo.inicio))
    anteriores = []
    ciclo = principal
    for _ in range(CICLOS_DE_COMPARACAO):
        ciclo = ciclo_anterior(ciclo)
        anteriores.insert(0, ciclo)
    return principal, [*anteriores, principal, ciclo_seguinte(principal)]


def analisar(
    gastos: list[GastoDaTag],
    *,
    totais: dict[Ciclo, TotaisDoCiclo],
    hoje: date,
) -> Analise:
    """`totais` traz, para cada ciclo de `ciclos_do_impacto`, o gasto e o que
    entrou na conta, sem pagamento de fatura nem transferência entre contas do
    dono. Ciclo ausente de `totais` não tem dado."""
    total = sum((gasto.valor for gasto in gastos), Decimal(0))
    if not gastos:
        return Analise(total, 0, Decimal(0), [], None, [], None, None)

    datas = [gasto.data for gasto in gastos]
    dias = (max(datas) - min(datas)).days + 1

    por_dia: dict[date, Decimal] = defaultdict(Decimal)
    por_categoria: dict[str, Decimal] = defaultdict(Decimal)
    for gasto in gastos:
        por_dia[gasto.data] += gasto.valor
        if gasto.categoria:
            por_categoria[gasto.categoria] += gasto.valor
    acumulado, soma = [], Decimal(0)
    for dia in sorted(por_dia):
        soma += por_dia[dia]
        acumulado.append((dia, soma))

    return Analise(
        total=total,
        dias=dias,
        por_dia=_centavos(total / dias),
        maiores=sorted(gastos, key=lambda gasto: (-gasto.valor, gasto.data))[:MAIORES],
        dia_mais_caro=max(por_dia.items(), key=lambda item: (item[1], item[0])),
        acumulado=acumulado,
        categoria_principal=max(por_categoria.items(), key=lambda item: item[1]) if por_categoria else None,
        impacto=_impacto(gastos, totais, hoje),
    )


def _impacto(gastos: list[GastoDaTag], totais: dict[Ciclo, TotaisDoCiclo], hoje: date) -> Impacto | None:
    ciclos = ciclos_do_impacto(gastos)
    if ciclos is None:
        return None
    principal, todos = ciclos
    anteriores = [ciclo for ciclo in todos if ciclo.fim < principal.inicio and ciclo in totais]
    if not anteriores or principal not in totais:
        return None

    tipico = _centavos(sum((totais[c].gasto for c in anteriores), Decimal(0)) / len(anteriores))
    sobra_media = _centavos(
        sum((totais[c].entrou - totais[c].gasto for c in anteriores), Decimal(0)) / len(anteriores)
    )
    gasto = totais[principal].gasto
    rombo = max(Decimal(0), gasto - tipico)

    da_tag: dict[Ciclo, Decimal] = defaultdict(Decimal)
    for item in gastos:
        da_tag[ciclo_de(item.data)] += item.valor
    rombo_da_tag = min(rombo, da_tag[principal])
    ciclos_para_recuperar = (
        math.ceil(rombo_da_tag / sobra_media) if rombo_da_tag > 0 and sobra_media > 0 else None
    )
    barras = [
        BarraDoCiclo(ciclo, totais[ciclo].gasto - da_tag[ciclo], da_tag[ciclo])
        for ciclo in todos
        if ciclo in totais and ciclo.inicio <= hoje
    ]
    return Impacto(principal, gasto, tipico, rombo, rombo_da_tag, sobra_media, ciclos_para_recuperar, barras)
