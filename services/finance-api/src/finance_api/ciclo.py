"""Ciclo de pagamento usado para acompanhar gastos em dois períodos mensais.

Lógica pura de calendário, sem banco. Dois pagamentos por mês, ancorados em
dia útil e não em dia fixo:

- P1 = dia útil anterior-ou-igual ao dia 5;
- P2 = dia útil posterior-ou-igual ao dia 15;
- Ciclo 1 = de P1 até a véspera de P2;
- Ciclo 2 = de P2 até a véspera do P1 do mês seguinte.

Por isso o Ciclo 2 atravessa a virada do mês, e o Ciclo 1 de janeiro começa
antes do dia 5 sempre que o dia 5 cai em fim de semana ou feriado.

Feriado da cidade, cadastrado pelo dono, muda só o pagamento de quem ele
marcou: quem paga o ciclo 1 (P1) ou quem paga o ciclo 2 (P2). Cada pagador
fica numa cidade, e o feriado de uma não mexe no pagamento da outra. A API
carrega esses feriados com `definir_feriados_locais`; sem nenhum, o
calendário é só o nacional.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

# Feriados nacionais de data fixa, como (mês, dia, nome). Os estaduais não
# entram; os da cidade o dono cadastra.
FERIADOS_NACIONAIS_FIXOS = (
    (1, 1, "Confraternização Universal"),
    (4, 21, "Tiradentes"),
    (5, 1, "Dia do Trabalho"),
    (9, 7, "Independência"),
    (10, 12, "Nossa Senhora Aparecida"),
    (11, 2, "Finados"),
    (11, 15, "Proclamação da República"),
    (11, 20, "Consciência Negra"),  # nacional desde a Lei 14.759/2023
    (12, 25, "Natal"),
)

# Datas móveis tratadas como não úteis pela regra. Carnaval e Corpus Christi
# são dias não úteis para operações do mercado financeiro pela Resolução CMN
# 4.880/2020. A Sexta-feira da Paixão é feriado religioso definido localmente,
# mas entra nesta aproximação por ser observada no calendário financeiro usado
# pelo projeto.
DATAS_MOVEIS_NAO_UTEIS = (
    (-48, "Carnaval"),
    (-47, "Carnaval"),
    (-2, "Sexta-feira Santa"),
    (60, "Corpus Christi"),
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


@dataclass(frozen=True)
class FeriadoLocal:
    """Feriado da cidade. `pagadores` diz de quem ele muda o pagamento: 1 é
    quem paga o ciclo 1, 2 quem paga o ciclo 2; vazio, só marca o dia."""

    nome: str
    data: date
    repete_todo_ano: bool
    pagadores: frozenset[int]

    def cai_em(self, dia: date) -> bool:
        if self.repete_todo_ano:
            return dia.year >= self.data.year and (dia.month, dia.day) == (self.data.month, self.data.day)
        return dia == self.data


_feriados_locais: tuple[FeriadoLocal, ...] = ()


def definir_feriados_locais(feriados: Iterable[FeriadoLocal]) -> None:
    """Troca os feriados da cidade que o calendário usa. Chamado pela API ao
    subir e a cada cadastro; o cálculo continua sem banco."""
    global _feriados_locais
    _feriados_locais = tuple(feriados)


def feriados_locais() -> tuple[FeriadoLocal, ...]:
    return _feriados_locais


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


def feriados_nacionais(ano: int) -> dict[date, str]:
    """Datas nacionais ou móveis tratadas como não úteis pela regra, com o nome."""
    domingo = pascoa(ano)
    datas = {date(ano, mes, dia): nome for mes, dia, nome in FERIADOS_NACIONAIS_FIXOS}
    datas.update({domingo + timedelta(days=offset): nome for offset, nome in DATAS_MOVEIS_NAO_UTEIS})
    return datas


def datas_nao_uteis_do_calendario(ano: int) -> frozenset[date]:
    """Datas nacionais ou móveis tratadas como não úteis pela regra."""
    return frozenset(feriados_nacionais(ano))


def e_dia_util(dia: date, pagador: int | None = None) -> bool:
    """Dia útil da regra: não é fim de semana nem data excluída. Com
    `pagador`, o feriado da cidade marcado para ele também exclui o dia."""
    if dia.weekday() >= 5 or dia in datas_nao_uteis_do_calendario(dia.year):
        return False
    return pagador is None or not any(
        pagador in feriado.pagadores and feriado.cai_em(dia) for feriado in _feriados_locais
    )


def dia_util_anterior_ou_igual(dia: date, pagador: int | None = None) -> date:
    while not e_dia_util(dia, pagador):
        dia -= timedelta(days=1)
    return dia


def dia_util_posterior_ou_igual(dia: date, pagador: int | None = None) -> date:
    while not e_dia_util(dia, pagador):
        dia += timedelta(days=1)
    return dia


def _mes_seguinte(ano: int, mes: int) -> tuple[int, int]:
    return (ano + 1, 1) if mes == 12 else (ano, mes + 1)


def _mes_anterior(ano: int, mes: int) -> tuple[int, int]:
    return (ano - 1, 12) if mes == 1 else (ano, mes - 1)


def p1(ano: int, mes: int) -> date:
    return dia_util_anterior_ou_igual(date(ano, mes, DIA_ANCORA_P1), pagador=1)


def p2(ano: int, mes: int) -> date:
    return dia_util_posterior_ou_igual(date(ano, mes, DIA_ANCORA_P2), pagador=2)


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


def dias_nao_uteis(inicio: date, fim: date) -> dict[date, str | None]:
    """Fim de semana e feriado entre as duas datas, inclusive, para marcar no
    gráfico. O valor é o nome do feriado, ou None no fim de semana comum.
    Feriado da cidade entra mesmo sem mudar pagamento nenhum."""
    dias: dict[date, str | None] = {}
    dia = inicio
    while dia <= fim:
        nome = feriados_nacionais(dia.year).get(dia) or next(
            (feriado.nome for feriado in _feriados_locais if feriado.cai_em(dia)), None
        )
        if nome is not None or dia.weekday() >= 5:
            dias[dia] = nome
        dia += timedelta(days=1)
    return dias
