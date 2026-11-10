from datetime import date
from decimal import Decimal

from finance_api.dinheiro_livre import (
    CompromissoAtivo,
    ContaFixa,
    RecorrenciaAprovada,
    calcular,
    contas_fixas_pendentes,
    estimar_dia_a_dia,
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


def test_livre_negativo_mostra_zero_hoje_e_quanto_falta_para_fechar() -> None:
    resultado = _exemplo(saldo_contas=D("500.00"), gastos_por_dia={})

    assert resultado.livre == D("-709.20")
    assert resultado.hoje_disponivel == D("0")
    assert resultado.falta_para_fechar == D("709.20")


def test_caso_reproduzido_da_spec_com_livre_de_50_negativos() -> None:
    resultado = _exemplo(
        saldo_contas=D("500.00"),
        cartao_usado=D("550.00"),
        contas_fixas=[],
        caixinha=D("0"),
        gastos_por_dia={INICIO: D("200.00")},
    )

    assert resultado.livre == D("-50.00")
    assert resultado.hoje_disponivel == D("0")
    assert resultado.falta_para_fechar == D("50.00")


def test_livre_zero_nao_falta_nada() -> None:
    """(0 + 200) / 10 = 20 de cota; 5 x 20 - 200 = -100 no cofrinho."""
    resultado = _exemplo(
        saldo_contas=D("550.00"), cartao_usado=D("550.00"), contas_fixas=[], caixinha=D("0"), gastos_por_dia={INICIO: D("200.00")}
    )

    assert resultado.falta_para_fechar == D("0")
    assert resultado.hoje_disponivel == D("-80.00")


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


# Cenário do dinheiro guardado na spec: cartão de 400, sem conta fixa, R$ 400
# gastos no dia 05. Sem aplicação o saldo é 2.000: cota 200, cofrinho 600.
def _guardando(saldo: str, guardado: dict[date, Decimal], **mudancas):
    return _exemplo(
        saldo_contas=D(saldo),
        cartao_usado=D("400.00"),
        contas_fixas=[],
        caixinha=D("0"),
        gastos_por_dia={INICIO: D("400.00")},
        guardado_por_dia=guardado,
        **mudancas,
    )


def test_sem_aplicacao_a_conta_e_a_de_sempre() -> None:
    resultado = _guardando("2000.00", {})

    assert (resultado.cota_do_dia, resultado.cofrinho, resultado.hoje_disponivel) == (D("200.00"), D("600.00"), D("800.00"))
    assert resultado.guardado_no_ciclo == D("0")
    assert resultado.guardado_em is None


def test_aplicacao_tira_da_cota_so_de_hoje_em_diante() -> None:
    """Livre 950 + 400 gastos + 650 guardados = 2.000 no começo, cota 200.
    De 10/10 a 14/10 são 5 dias: 650 / 5 = 130 a menos, cota 70. Cofrinho
    5 x 200 - 400 = 600, igual ao de sem aplicação. 5 x 70 + 600 = 950."""
    resultado = _guardando("1350.00", {HOJE: D("650.00")})

    assert resultado.livre == D("950.00")
    assert resultado.cota_do_dia == D("70.00")
    assert resultado.cofrinho == D("600.00")
    assert resultado.hoje_disponivel == D("670.00")
    assert resultado.guardado_no_ciclo == D("650.00")
    assert resultado.guardado_em == HOJE


def test_resgate_devolve_o_que_a_aplicacao_tirou() -> None:
    """Aplicou 650 em 07/10 e resgatou tudo hoje. De 07 a 09 a cota foi
    200 - 650 / 8 = 118,75; de hoje em diante 118,75 + 650 / 5 = 248,75.
    Cofrinho 2 x 200 + 3 x 118,75 - 400 = 356,25; hoje 605,00, e
    605 + 4 x 248,75 = 1.600, o livre."""
    resultado = _guardando("2000.00", {date(2026, 10, 7): D("650.00"), HOJE: D("-650.00")})

    assert resultado.cota_do_dia == D("248.75")
    assert resultado.cofrinho == D("356.25")
    assert resultado.hoje_disponivel == D("605.00")
    assert resultado.guardado_no_ciclo == D("0")
    assert resultado.guardado_em is None


def test_aplicar_no_primeiro_dia_e_comecar_com_menos_livre() -> None:
    """O saldo já é o de depois da aplicação: 2.000 menos os 1.000 aplicados."""
    aplicado = _guardando("1000.00", {INICIO: D("1000.00")})
    sem_o_dinheiro = _guardando("1000.00", {})

    assert aplicado.cota_do_dia == sem_o_dinheiro.cota_do_dia == D("100.00")
    assert aplicado.cofrinho == sem_o_dinheiro.cofrinho == D("100.00")
    assert aplicado.hoje_disponivel == sem_o_dinheiro.hoje_disponivel


def test_data_do_guardado_e_a_da_ultima_aplicacao() -> None:
    resultado = _guardando("1700.00", {date(2026, 10, 6): D("200.00"), date(2026, 10, 8): D("100.00")})

    assert resultado.guardado_no_ciclo == D("300.00")
    assert resultado.guardado_em == date(2026, 10, 8)


def test_guardado_fora_do_ciclo_nao_conta() -> None:
    resultado = _guardando("2000.00", {date(2026, 10, 2): D("500.00")})

    assert resultado.cota_do_dia == D("200.00")
    assert resultado.guardado_no_ciclo == D("0")


def test_recalcular_com_os_mesmos_dados_da_o_mesmo_numero() -> None:
    assert _guardando("1350.00", {HOJE: D("650.00")}) == _guardando("1350.00", {HOJE: D("650.00")})


def _recomendando(saldo: str, estimativa: str | None):
    """Saldo menos 400 do cartão e 600 de contas fixas; hoje é o sexto de 10 dias."""
    return _exemplo(
        saldo_contas=D(saldo),
        cartao_usado=D("400.00"),
        contas_fixas=[ContaFixa("Aluguel fictício", D("600.00"), date(2026, 10, 12), "recorrencia", False)],
        caixinha=D("0"),
        gastos_por_dia={INICIO: D("400.00")},
        estimativa_por_dia=None if estimativa is None else D(estimativa),
    )


def test_da_para_guardar_o_livre_acima_do_dia_a_dia_de_costume() -> None:
    """Livre 1.000; 70 por dia x 5 dias = 350; sobram 650."""
    assert _recomendando("2000.00", "70.00").da_para_guardar == D("650.00")


def test_da_para_guardar_arredonda_para_baixo_em_dezenas() -> None:
    assert _recomendando("2005.00", "70.00").da_para_guardar == D("650.00")
    assert _recomendando("2019.99", "70.00").da_para_guardar == D("660.00")


def test_quando_nao_sobra_a_recomendacao_e_zero() -> None:
    assert _recomendando("1340.00", "70.00").da_para_guardar == D("0.00")
    assert _recomendando("500.00", "70.00").da_para_guardar == D("0.00")


def test_sem_estimativa_nao_ha_recomendacao() -> None:
    assert _recomendando("2000.00", None).da_para_guardar is None


def test_recomendacao_nao_muda_a_cota() -> None:
    com = _recomendando("2000.00", "70.00")
    sem = _recomendando("2000.00", None)

    assert (com.cota_do_dia, com.cofrinho, com.hoje_disponivel) == (sem.cota_do_dia, sem.cofrinho, sem.hoje_disponivel)


def test_estimativa_e_a_mediana_e_um_ciclo_atipico_nao_puxa() -> None:
    """Ordenadas: 80, 85, 90, 95, 100, 300 (uma viagem). Mediana (90 + 95) / 2."""
    medias = [D("100"), D("80"), D("300"), D("90"), D("85"), D("95")]

    assert estimar_dia_a_dia(medias) == D("92.50")
    assert estimar_dia_a_dia([D("70"), D("500"), D("60")]) == D("70.00")


def test_estimativa_precisa_de_dois_ciclos() -> None:
    assert estimar_dia_a_dia([]) is None
    assert estimar_dia_a_dia([D("70")]) is None
    assert estimar_dia_a_dia([D("70"), D("90")]) == D("80.00")
