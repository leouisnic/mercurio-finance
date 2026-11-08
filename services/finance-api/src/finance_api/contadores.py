"""Contadores do período: dias de ouro, sequência sem gasto, dias dentro da
cota e o gasto contra o mesmo ciclo do mês anterior.

Lógica pura, sem banco. As regras estão em
`docs/specs/archive/2026-11-04-filtros-e-contadores.md`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal


@dataclass(frozen=True)
class Contadores:
    dias: int
    dias_de_ouro: int
    dias_de_ouro_no_total: int
    sequencia: int
    recorde: int
    # Só com cota positiva observada para um ciclo inteiro e sem filtro.
    dentro_da_cota: int | None
    acima_da_cota: int | None


def _dias(inicio: date, fim: date) -> list[date]:
    return [inicio + timedelta(days=n) for n in range((fim - inicio).days + 1)]


def calcular(
    gastos_por_dia: dict[date, Decimal],
    *,
    inicio: date,
    fim: date,
    hoje: date,
    primeiro_dia: date | None,
    cota: Decimal | None = None,
) -> Contadores:
    """Conta do início do período até hoje, inclusive, ou até o fim, se o
    período já acabou. Hoje é dia de ouro enquanto não houver gasto nele.

    `gastos_por_dia` cobre do `primeiro_dia` (o movimento mais antigo) ao
    fim: o total e a sequência olham o histórico inteiro, não só o período.
    """
    ultimo = min(fim, hoje)
    periodo = _dias(inicio, ultimo) if inicio <= ultimo else []
    historico = _dias(primeiro_dia, ultimo) if primeiro_dia and primeiro_dia <= ultimo else []

    def sem_gasto(dia: date) -> bool:
        return gastos_por_dia.get(dia, Decimal(0)) <= 0

    sequencia = recorde = atual = 0
    for dia in historico:
        atual = atual + 1 if sem_gasto(dia) else 0
        recorde = max(recorde, atual)
    sequencia = atual

    dentro = acima = None
    if cota is not None:
        dentro = sum(1 for dia in periodo if gastos_por_dia.get(dia, Decimal(0)) <= cota)
        acima = len(periodo) - dentro

    return Contadores(
        dias=len(periodo),
        dias_de_ouro=sum(1 for dia in periodo if sem_gasto(dia)),
        dias_de_ouro_no_total=sum(1 for dia in historico if sem_gasto(dia)),
        sequencia=sequencia,
        recorde=recorde,
        dentro_da_cota=dentro,
        acima_da_cota=acima,
    )


def gasto_ate_o_dia(gastos_por_dia: dict[date, Decimal], inicio: date, dias: int, fim: date) -> Decimal:
    """Soma do `inicio` até o dia número `dias` do período (1 é o próprio
    início), sem passar do `fim`. É o "mesmo ponto" de outro ciclo, contado
    pela posição e não pela data, porque os ciclos têm tamanhos diferentes."""
    ultimo = min(inicio + timedelta(days=dias - 1), fim)
    return sum((valor for dia, valor in gastos_por_dia.items() if inicio <= dia <= ultimo), Decimal(0))


DIAS_DA_SEMANA = ("segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo")


@dataclass(frozen=True)
class DiaUtilContraNaoUtil:
    parte_nao_util: Decimal  # de 0 a 1
    dia_mais_caro: str | None
    media_do_dia_mais_caro: Decimal


def dia_util_contra_nao_util(
    gastos_por_dia: dict[date, Decimal], dias: list[date], nao_uteis: set[date]
) -> DiaUtilContraNaoUtil | None:
    """Quanto do gasto caiu em fim de semana ou feriado, e o dia da semana com
    a maior média por dia. A média conta os dias sem gasto, senão um sábado
    caro e raro pareceria o hábito da semana."""
    total = sum((gastos_por_dia.get(dia, Decimal(0)) for dia in dias), Decimal(0))
    if total <= 0:
        return None
    nao_util = sum((gastos_por_dia.get(dia, Decimal(0)) for dia in dias if dia in nao_uteis), Decimal(0))
    por_semana: dict[int, list[Decimal]] = {}
    for dia in dias:
        por_semana.setdefault(dia.weekday(), []).append(gastos_por_dia.get(dia, Decimal(0)))
    medias = {semana: sum(valores, Decimal(0)) / len(valores) for semana, valores in por_semana.items()}
    semana = max(medias, key=lambda chave: medias[chave])
    return DiaUtilContraNaoUtil(nao_util / total, DIAS_DA_SEMANA[semana], medias[semana])


def categoria_que_mais_cresceu(
    atual: dict[str, Decimal], anterior: dict[str, Decimal]
) -> tuple[str, Decimal] | None:
    """A categoria com o maior aumento contra o outro período; sem aumento, nenhuma."""
    aumentos = {categoria: valor - anterior.get(categoria, Decimal(0)) for categoria, valor in atual.items()}
    if not aumentos:
        return None
    categoria = max(aumentos, key=lambda chave: aumentos[chave])
    return (categoria, aumentos[categoria]) if aumentos[categoria] > 0 else None
