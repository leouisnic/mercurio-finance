"""Ciclo de pagamento usado para acompanhar gastos em dois períodos mensais.

Lógica pura de calendário, sem banco. Dois pagamentos por mês, ancorados em
dia útil e não em dia fixo:

- P1 = dia útil anterior-ou-igual ao dia 5;
- P2 = dia útil posterior-ou-igual ao dia 15;
- Ciclo 1 = de P1 até a véspera de P2;
- Ciclo 2 = de P2 até a véspera do P1 do mês seguinte.

Por isso o Ciclo 2 atravessa a virada do mês, e o Ciclo 1 de janeiro começa
antes do dia 5 sempre que o dia 5 cai em fim de semana ou feriado.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

# Feriados nacionais de data fixa, como (mês, dia). Feriados estaduais e
# municipais ficam fora desta primeira aproximação do calendário.
FERIADOS_NACIONAIS_FIXOS = (
    (1, 1),  # Confraternização Universal
    (4, 21),  # Tiradentes
    (5, 1),  # Dia do Trabalho
    (9, 7),  # Independência
    (10, 12),  # Nossa Senhora Aparecida
    (11, 2),  # Finados
    (11, 15),  # Proclamação da República
    (11, 20),  # Consciência Negra (nacional desde a Lei 14.759/2023)
    (12, 25),  # Natal
)

# Datas móveis tratadas como não úteis pela regra. Carnaval e Corpus Christi
# são dias não úteis para operações do mercado financeiro pela Resolução CMN
# 4.880/2020. A Sexta-feira da Paixão é feriado religioso definido localmente,
# mas entra nesta aproximação por ser observada no calendário financeiro usado
# pelo projeto.
DATAS_MOVEIS_NAO_UTEIS = (
    -48,  # Carnaval (segunda)
    -47,  # Carnaval (terça)
    -2,  # Sexta-feira Santa
    60,  # Corpus Christi
)

DIA_ANCORA_P1 = 5
DIA_ANCORA_P2 = 15


@dataclass(frozen=True)
class Ciclo:
    numero: int
    inicio: date
    fim: date

    def contem(self, dia: date) -> bool:
        return self.inicio <= dia <= self.fim


def pascoa(ano: int) -> date:
    """Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher."""
    a = ano % 19
    b, c = divmod(ano, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    j = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * j) // 451
    mes, dia = divmod(h + j - 7 * m + 114, 31)
    return date(ano, mes, dia + 1)


def datas_nao_uteis_do_calendario(ano: int) -> frozenset[date]:
    """Datas nacionais ou móveis tratadas como não úteis pela regra."""
    domingo = pascoa(ano)
    fixos = (date(ano, mes, dia) for mes, dia in FERIADOS_NACIONAIS_FIXOS)
    moveis = (domingo + timedelta(days=offset) for offset in DATAS_MOVEIS_NAO_UTEIS)
    return frozenset((*fixos, *moveis))


def e_dia_util(dia: date) -> bool:
    """Dia útil da regra: não é fim de semana nem data excluída."""
    return dia.weekday() < 5 and dia not in datas_nao_uteis_do_calendario(dia.year)


def dia_util_anterior_ou_igual(dia: date) -> date:
    while not e_dia_util(dia):
        dia -= timedelta(days=1)
    return dia


def dia_util_posterior_ou_igual(dia: date) -> date:
    while not e_dia_util(dia):
        dia += timedelta(days=1)
    return dia


def _mes_seguinte(ano: int, mes: int) -> tuple[int, int]:
    return (ano + 1, 1) if mes == 12 else (ano, mes + 1)


def _mes_anterior(ano: int, mes: int) -> tuple[int, int]:
    return (ano - 1, 12) if mes == 1 else (ano, mes - 1)


def p1(ano: int, mes: int) -> date:
    return dia_util_anterior_ou_igual(date(ano, mes, DIA_ANCORA_P1))


def p2(ano: int, mes: int) -> date:
    return dia_util_posterior_ou_igual(date(ano, mes, DIA_ANCORA_P2))


def ciclos_do_mes(ano: int, mes: int) -> tuple[Ciclo, Ciclo]:
    """Os dois ciclos que começam neste mês. O Ciclo 2 termina no mês
    seguinte, na véspera do P1 de lá."""
    inicio_1 = p1(ano, mes)
    inicio_2 = p2(ano, mes)
    inicio_do_proximo = p1(*_mes_seguinte(ano, mes))
    return (
        Ciclo(1, inicio_1, inicio_2 - timedelta(days=1)),
        Ciclo(2, inicio_2, inicio_do_proximo - timedelta(days=1)),
    )


def ciclo_de(dia: date) -> Ciclo:
    """Em que ciclo esta data cai.

    Uma data anterior ao P1 do próprio mês pertence ao Ciclo 2 do mês
    passado, que ainda não terminou.
    """
    for ano, mes in (_mes_anterior(dia.year, dia.month), (dia.year, dia.month)):
        for ciclo in ciclos_do_mes(ano, mes):
            if ciclo.contem(dia):
                return ciclo
    raise AssertionError(f"nenhum ciclo cobre {dia.isoformat()}")


def ciclo_anterior(ciclo: Ciclo) -> Ciclo:
    return ciclo_de(ciclo.inicio - timedelta(days=1))


def ciclo_seguinte(ciclo: Ciclo) -> Ciclo:
    return ciclo_de(ciclo.fim + timedelta(days=1))
