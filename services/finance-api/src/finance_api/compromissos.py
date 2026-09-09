"""Calendário de parcelas de um compromisso futuro.

Lógica pura de calendário, sem banco. É camada de planejamento: as datas
aqui são o que está previsto, nunca o que aconteceu. O histórico real
continua sendo só `movimentos`, e as duas coisas não são conciliadas
automaticamente (ver docs/decisions.md).
"""

from __future__ import annotations

import calendar
from datetime import date


def somar_meses(inicio: date, meses: int) -> date:
    """Mesmo dia do mês, `meses` à frente, sem estourar o fim do mês.

    Dia 31 + 1 mês num mês de 30 dias vira dia 30, não dia 1 do mês
    seguinte (que é o que somar dias daria).
    """
    total = inicio.month - 1 + meses
    ano = inicio.year + total // 12
    mes = total % 12 + 1
    ultimo_dia_do_mes = calendar.monthrange(ano, mes)[1]
    return date(ano, mes, min(inicio.day, ultimo_dia_do_mes))


def parcelas(data_inicio: date, data_fim: date) -> list[date]:
    """Todas as datas de parcela entre início e fim, inclusive nas duas
    pontas. Só periodicidade mensal por enquanto."""
    if data_fim < data_inicio:
        return []

    meses_ate_o_fim = (data_fim.year - data_inicio.year) * 12 + (data_fim.month - data_inicio.month)
    datas = (somar_meses(data_inicio, indice) for indice in range(meses_ate_o_fim + 1))
    return [data for data in datas if data <= data_fim]


def resumo_parcelas(
    data_inicio: date, data_fim: date, hoje: date, *, ativo: bool
) -> tuple[date | None, int, int]:
    """Devolve `(proxima_parcela, parcelas_total, parcelas_restantes)`.

    Compromisso que não está ativo (quitado ou cancelado à mão) não tem
    próxima parcela nem restante, mesmo que ainda haja data no futuro: o
    uma obrigação encerrada não volte a aparecer.
    """
    todas = parcelas(data_inicio, data_fim)
    if not ativo:
        return None, len(todas), 0

    futuras = [data for data in todas if data >= hoje]
    return (futuras[0] if futuras else None), len(todas), len(futuras)
