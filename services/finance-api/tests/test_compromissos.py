"""Calendário de parcelas de compromisso: lógica pura, sem banco."""

from datetime import date

from finance_api.compromissos import parcelas, resumo_parcelas, somar_meses


def test_somar_meses_nao_estoura_o_fim_do_mes() -> None:
    """Dia 31 + 1 mês num mês de 30 dias tem que virar dia 30, não dia 1
    do mês seguinte."""
    assert somar_meses(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert somar_meses(date(2026, 3, 31), 1) == date(2026, 4, 30)
    assert somar_meses(date(2026, 1, 15), 12) == date(2027, 1, 15)


def test_parcelas_incluem_inicio_e_fim() -> None:
    datas = parcelas(date(2026, 1, 15), date(2026, 6, 15))

    assert len(datas) == 6
    assert datas[0] == date(2026, 1, 15)
    assert datas[-1] == date(2026, 6, 15)


def test_parcela_que_cairia_depois_do_fim_nao_entra() -> None:
    datas = parcelas(date(2026, 1, 31), date(2026, 3, 30))

    assert datas == [date(2026, 1, 31), date(2026, 2, 28)]


def test_fim_antes_do_inicio_nao_gera_parcela() -> None:
    assert parcelas(date(2026, 6, 15), date(2026, 1, 15)) == []


def test_resumo_conta_so_as_parcelas_que_ainda_vao_acontecer() -> None:
    proxima, total, restantes = resumo_parcelas(
        date(2026, 1, 15), date(2026, 6, 15), hoje=date(2026, 4, 1), ativo=True
    )

    assert total == 6
    assert restantes == 3  # abril, maio e junho
    assert proxima == date(2026, 4, 15)


def test_parcela_de_hoje_ainda_conta_como_restante() -> None:
    proxima, _, restantes = resumo_parcelas(
        date(2026, 1, 15), date(2026, 6, 15), hoje=date(2026, 4, 15), ativo=True
    )

    assert proxima == date(2026, 4, 15)
    assert restantes == 3


def test_compromisso_nao_ativo_nao_tem_proxima_parcela() -> None:
    """Quitado ou cancelado à mão: mesmo com data no futuro, acabou."""
    proxima, total, restantes = resumo_parcelas(
        date(2026, 1, 15), date(2026, 6, 15), hoje=date(2026, 4, 1), ativo=False
    )

    assert proxima is None
    assert total == 6
    assert restantes == 0


def test_compromisso_ja_terminado_nao_tem_proxima_parcela() -> None:
    proxima, total, restantes = resumo_parcelas(
        date(2026, 1, 15), date(2026, 6, 15), hoje=date(2027, 1, 1), ativo=True
    )

    assert proxima is None
    assert total == 6
    assert restantes == 0
