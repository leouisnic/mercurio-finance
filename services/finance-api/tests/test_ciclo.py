from datetime import date, timedelta

import pytest
from finance_api.ciclo import (
    Ciclo,
    ciclo_anterior,
    ciclo_de,
    ciclo_seguinte,
    ciclos_do_mes,
    datas_nao_uteis_do_calendario,
    dia_util_anterior_ou_igual,
    dia_util_posterior_ou_igual,
    e_dia_util,
    p1,
    p2,
    pascoa,
)


@pytest.mark.parametrize(
    ("ano", "esperado"),
    [
        (2024, date(2024, 3, 31)),
        (2025, date(2025, 4, 20)),
        (2026, date(2026, 4, 5)),
        (2027, date(2027, 3, 28)),
    ],
)
def test_pascoa(ano: int, esperado: date) -> None:
    assert pascoa(ano) == esperado


def test_datas_moveis_saem_da_pascoa() -> None:
    """As exclusões móveis mudam com a Páscoa, que cai em 05/04 em 2026."""
    feriados = datas_nao_uteis_do_calendario(2026)

    assert date(2026, 2, 16) in feriados  # segunda de Carnaval
    assert date(2026, 2, 17) in feriados  # terça de Carnaval
    assert date(2026, 4, 3) in feriados  # Sexta-feira Santa
    assert date(2026, 6, 4) in feriados  # Corpus Christi


def test_consciencia_negra_e_feriado_nacional() -> None:
    assert date(2026, 11, 20) in datas_nao_uteis_do_calendario(2026)


def test_fim_de_semana_e_feriado_nao_sao_dia_util() -> None:
    assert not e_dia_util(date(2026, 9, 5))  # sábado
    assert not e_dia_util(date(2026, 9, 6))  # domingo
    assert not e_dia_util(date(2026, 9, 7))  # Independência, uma segunda
    assert e_dia_util(date(2026, 9, 8))


def test_dia_util_anterior_pula_o_feriado_e_o_fim_de_semana() -> None:
    # 05/09/2026 é sábado: o dia útil anterior é a sexta, 04/09.
    assert dia_util_anterior_ou_igual(date(2026, 9, 5)) == date(2026, 9, 4)
    # Data que já é dia útil não se move.
    assert dia_util_anterior_ou_igual(date(2026, 9, 4)) == date(2026, 9, 4)


def test_dia_util_posterior_pula_carnaval_inteiro() -> None:
    # 15/02/2026 é domingo, 16 e 17 são Carnaval: o próximo dia útil é 18.
    assert dia_util_posterior_ou_igual(date(2026, 2, 15)) == date(2026, 2, 18)


def test_ciclos_de_setembro_de_2026() -> None:
    """Dia 5 cai no sábado, então P1 recua para a sexta; dia 15 é terça e
    já é dia útil."""
    assert p1(2026, 9) == date(2026, 9, 4)
    assert p2(2026, 9) == date(2026, 9, 15)

    ciclo_1, ciclo_2 = ciclos_do_mes(2026, 9)

    assert ciclo_1 == Ciclo(1, date(2026, 9, 4), date(2026, 9, 14))
    assert ciclo_2 == Ciclo(2, date(2026, 9, 15), date(2026, 10, 4))


def test_ciclo_1_encolhe_quando_o_carnaval_empurra_o_p2() -> None:
    ciclo_1, ciclo_2 = ciclos_do_mes(2026, 2)

    assert ciclo_1 == Ciclo(1, date(2026, 2, 5), date(2026, 2, 17))
    assert ciclo_2 == Ciclo(2, date(2026, 2, 18), date(2026, 3, 4))


def test_p2_pula_quando_o_dia_15_e_domingo_e_feriado() -> None:
    """15/11/2026 é domingo e também Proclamação da República."""
    assert p2(2026, 11) == date(2026, 11, 16)


def test_ciclo_2_atravessa_a_virada_do_ano() -> None:
    _, ciclo_2 = ciclos_do_mes(2025, 12)

    assert ciclo_2 == Ciclo(2, date(2025, 12, 15), date(2026, 1, 4))


def test_data_antes_do_p1_pertence_ao_ciclo_2_do_mes_passado() -> None:
    """01/09/2026 é setembro no calendário, mas o Ciclo 1 de setembro só
    abre em 04/09: o dinheiro desse dia ainda é do ciclo anterior."""
    assert ciclo_de(date(2026, 9, 1)) == Ciclo(2, date(2026, 8, 17), date(2026, 9, 3))


@pytest.mark.parametrize(
    ("dia", "numero"),
    [
        (date(2026, 9, 4), 1),  # primeiro dia do Ciclo 1
        (date(2026, 9, 14), 1),  # último dia do Ciclo 1
        (date(2026, 9, 15), 2),  # primeiro dia do Ciclo 2
        (date(2026, 10, 4), 2),  # último dia do Ciclo 2, já em outubro
        (date(2026, 10, 5), 1),  # Ciclo 1 de outubro
    ],
)
def test_ciclo_de_nas_bordas(dia: date, numero: int) -> None:
    assert ciclo_de(dia).numero == numero


def test_todo_dia_do_ano_cai_em_exatamente_um_ciclo() -> None:
    """Não pode existir buraco nem sobreposição entre ciclos: cada dia de
    2026 pertence a um, e o ciclo seguinte começa no dia seguinte ao fim
    do anterior."""
    dia = date(2026, 1, 1)
    while dia <= date(2026, 12, 31):
        ciclo = ciclo_de(dia)
        assert ciclo.contem(dia)
        assert ciclo_seguinte(ciclo).inicio == ciclo.fim + timedelta(days=1)
        dia += timedelta(days=1)


def test_ciclo_anterior_e_seguinte_sao_inversos() -> None:
    ciclo = ciclo_de(date(2026, 9, 20))

    assert ciclo_seguinte(ciclo_anterior(ciclo)) == ciclo
    assert ciclo_anterior(ciclo_seguinte(ciclo)) == ciclo
