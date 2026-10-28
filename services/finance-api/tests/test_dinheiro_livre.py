from datetime import date
from decimal import Decimal

from finance_api.dinheiro_livre import (
    CompromissoAtivo,
    ContaFixa,
    RecorrenciaAprovada,
    calcular,
    contas_fixas_pendentes,
)

INICIO = date(2026, 10, 5)
FIM = date(2026, 10, 14)
HOJE = date(2026, 10, 10)
D = Decimal

FIXAS = [
    ContaFixa("Internet", D("99.90"), date(2026, 10, 12), "recorrencia", False),
    ContaFixa("Academia", D("89.00"), date(2026, 10, 13), "recorrencia", False),
]
GASTOS = {date(2026, 10, 5): D("120.00"), date(2026, 10, 7): D("450.00"), date(2026, 10, 9): D("173.70")}


def _exemplo(**mudancas):
    argumentos = {
        "hoje": HOJE,
        "inicio": INICIO,
        "fim": FIM,
        "saldo_contas": D("3152.90"),
        "cartao_usado": D("640.30"),
        "contas_fixas": FIXAS,
        "gastos_por_dia": GASTOS,
        "caixinha": D("380.00"),
    }
    argumentos.update(mudancas)
    return calcular(**argumentos)


def test_exemplo_da_spec_conferido_a_mao() -> None:
    """3.152,90 - 640,30 - 188,90 - 380,00 = 1.943,70 livres.
    (1.943,70 + 743,70 gastos) / 10 dias = 268,74 de cota.
    5 dias x 268,74 - 743,70 = 600,00 no cofrinho; hoje 868,74."""
    resultado = _exemplo()

    assert resultado.contas_fixas_total == D("188.90")
    assert resultado.livre == D("1943.70")
    assert resultado.dias_do_ciclo == 10
    assert resultado.dias_restantes == 5
    assert resultado.cota_do_dia == D("268.74")
    assert resultado.cofrinho == D("600.00")
    assert resultado.hoje_disponivel == D("868.74")


def test_hoje_mais_as_cotas_que_faltam_fecha_com_o_livre() -> None:
    resultado = _exemplo()

    restantes_depois_de_hoje = resultado.dias_restantes - 1
    assert resultado.hoje_disponivel + resultado.cota_do_dia * restantes_depois_de_hoje == resultado.livre


def test_gastar_hoje_tira_do_disponivel_sem_mudar_a_cota() -> None:
    """O gasto de hoje já saiu do saldo e entra de volta na reconstrução."""
    resultado = _exemplo(saldo_contas=D("3032.90"), gastos_por_dia={**GASTOS, HOJE: D("120.00")})

    assert resultado.cota_do_dia == D("268.74")
    assert resultado.gasto_hoje == D("120.00")
    assert resultado.hoje_disponivel == D("748.74")


def test_gastar_acima_da_cota_deixa_o_cofrinho_negativo() -> None:
    gastos = {date(2026, 10, 5): D("2000.00")}
    resultado = _exemplo(saldo_contas=D("1896.20"), gastos_por_dia=gastos)

    # (1.896,20 - 640,30 - 188,90 - 380 + 2.000) / 10 = 268,70; 5 x 268,70 - 2.000.
    assert resultado.cota_do_dia == D("268.70")
    assert resultado.cofrinho == D("-656.50")


def test_primeiro_dia_do_ciclo_comeca_sem_cofrinho() -> None:
    resultado = _exemplo(hoje=INICIO, gastos_por_dia={})

    assert resultado.dias_restantes == 10
    assert resultado.cofrinho == D("0")
    assert resultado.hoje_disponivel == resultado.cota_do_dia


def test_livre_negativo_nao_vira_positivo() -> None:
    resultado = _exemplo(saldo_contas=D("500.00"), gastos_por_dia={})

    assert resultado.livre == D("-709.20")
    assert resultado.hoje_disponivel < 0


def test_dias_sem_gasto_aparecem_com_zero_ate_hoje() -> None:
    resultado = _exemplo()

    assert list(resultado.gastos_por_dia) == [date(2026, 10, dia) for dia in range(5, 11)]
    assert resultado.gastos_por_dia[date(2026, 10, 6)] == D("0")


def _recorrencia(ultima: date, nome: str = "Internet") -> RecorrenciaAprovada:
    return RecorrenciaAprovada(nome, D("99.90"), ultima)


def _pendentes(recorrencias=(), compromissos=(), hoje=HOJE):
    return contas_fixas_pendentes(list(recorrencias), list(compromissos), hoje=hoje, inicio=INICIO, fim=FIM)


def test_recorrencia_prevista_no_ciclo_esta_pendente() -> None:
    (conta,) = _pendentes([_recorrencia(date(2026, 9, 12))])

    assert conta.data_prevista == date(2026, 10, 12)
    assert not conta.atrasada


def test_recorrencia_ja_cobrada_no_ciclo_nao_desconta_de_novo() -> None:
    """A cobrança de 08/10 já saiu do saldo; a próxima é 08/11."""
    assert _pendentes([_recorrencia(date(2026, 10, 8))]) == []


def test_recorrencia_prevista_e_nao_vista_fica_atrasada() -> None:
    (conta,) = _pendentes([_recorrencia(date(2026, 9, 7))])

    assert conta.data_prevista == date(2026, 10, 7)
    assert conta.atrasada


def test_recorrencia_que_parou_de_vir_nao_entra() -> None:
    assert _pendentes([_recorrencia(date(2026, 8, 20))]) == []


def test_recorrencia_depois_do_pagamento_fica_para_o_proximo_ciclo() -> None:
    assert _pendentes([_recorrencia(date(2026, 9, 20))]) == []


def test_compromisso_entra_so_de_hoje_em_diante() -> None:
    """Sem conciliação com o extrato, parcela antes de hoje é dada como paga."""
    compromissos = [
        CompromissoAtivo("Curso", D("150.00"), date(2026, 8, 6), date(2026, 12, 6)),
        CompromissoAtivo("Seguro", D("80.00"), date(2026, 8, 11), date(2026, 12, 11)),
    ]

    (conta,) = _pendentes(compromissos=compromissos)

    assert conta.nome == "Seguro"
    assert conta.data_prevista == date(2026, 10, 11)


def test_parcelamento_depois_da_ultima_parcela_nao_entra() -> None:
    parcela = RecorrenciaAprovada("Parcela", D("84.42"), date(2026, 9, 12), fim_previsto=date(2026, 9, 12))
    ainda_vem = RecorrenciaAprovada("Parcela", D("84.42"), date(2026, 9, 12), fim_previsto=date(2026, 10, 12))

    assert _pendentes([parcela]) == []
    assert [conta.data_prevista for conta in _pendentes([ainda_vem])] == [date(2026, 10, 12)]
