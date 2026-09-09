"""Detecção de recorrência: lógica pura, sem banco."""

from datetime import date
from decimal import Decimal

from finance_api.recorrencias import LancamentoObservado, detectar_recorrencias


def _lancamento(dia: date, valor: str, descricao: str = "Assinatura", conta: str = "conta-a"):
    return LancamentoObservado(
        conta_id=conta, descricao=descricao, data=dia, valor=Decimal(valor)
    )


def test_tres_cobrancas_mensais_iguais_viram_candidata() -> None:
    candidatas = detectar_recorrencias(
        [
            _lancamento(date(2026, 1, 10), "39.90"),
            _lancamento(date(2026, 2, 10), "39.90"),
            _lancamento(date(2026, 3, 10), "39.90"),
        ]
    )

    assert len(candidatas) == 1
    candidata = candidatas[0]
    assert candidata.descricao == "Assinatura"
    assert candidata.ocorrencias == 3
    assert candidata.valor_medio == Decimal("39.90")
    assert candidata.primeira_data == date(2026, 1, 10)
    assert candidata.ultima_data == date(2026, 3, 10)


def test_duas_cobrancas_nao_bastam() -> None:
    """Com duas, qualquer par de compras parecidas com um mês de intervalo
    viraria recorrência."""
    candidatas = detectar_recorrencias(
        [
            _lancamento(date(2026, 1, 10), "39.90"),
            _lancamento(date(2026, 2, 10), "39.90"),
        ]
    )

    assert candidatas == []


def test_cobranca_semanal_nao_e_recorrencia_mensal() -> None:
    candidatas = detectar_recorrencias(
        [
            _lancamento(date(2026, 1, 5), "39.90"),
            _lancamento(date(2026, 1, 12), "39.90"),
            _lancamento(date(2026, 1, 19), "39.90"),
        ]
    )

    assert candidatas == []


def test_reajuste_dentro_da_tolerancia_continua_sendo_a_mesma_recorrencia() -> None:
    """Assinatura reajusta: 100 -> 110 -> 120 é 10% e 9%, dentro dos 15%."""
    candidatas = detectar_recorrencias(
        [
            _lancamento(date(2026, 1, 10), "100.00"),
            _lancamento(date(2026, 2, 10), "110.00"),
            _lancamento(date(2026, 3, 10), "120.00"),
        ]
    )

    assert len(candidatas) == 1
    assert candidatas[0].valor_medio == Decimal("110.00")


def test_valor_muito_diferente_quebra_a_sequencia() -> None:
    candidatas = detectar_recorrencias(
        [
            _lancamento(date(2026, 1, 10), "100.00"),
            _lancamento(date(2026, 2, 10), "200.00"),
            _lancamento(date(2026, 3, 10), "300.00"),
        ]
    )

    assert candidatas == []


def test_usa_a_maior_sequencia_encadeada_e_ignora_o_resto() -> None:
    """Mesma descrição, mas o valor muda no meio: só o trecho encadeado
    a partir daí forma a recorrência."""
    candidatas = detectar_recorrencias(
        [
            _lancamento(date(2026, 1, 10), "100.00"),
            _lancamento(date(2026, 2, 10), "100.00"),
            _lancamento(date(2026, 3, 10), "500.00"),
            _lancamento(date(2026, 4, 10), "500.00"),
            _lancamento(date(2026, 5, 10), "500.00"),
        ]
    )

    assert len(candidatas) == 1
    candidata = candidatas[0]
    assert candidata.ocorrencias == 3
    assert candidata.valor_medio == Decimal("500.00")
    assert candidata.primeira_data == date(2026, 3, 10)


def test_fim_de_mes_com_fevereiro_no_meio_continua_mensal() -> None:
    """31/01 -> 28/02 -> 31/03: 28 e 31 dias, os dois dentro da faixa."""
    candidatas = detectar_recorrencias(
        [
            _lancamento(date(2026, 1, 31), "80.00"),
            _lancamento(date(2026, 2, 28), "80.00"),
            _lancamento(date(2026, 3, 31), "80.00"),
        ]
    )

    assert len(candidatas) == 1
    assert candidatas[0].ocorrencias == 3


def test_mesma_descricao_em_contas_diferentes_nao_se_mistura() -> None:
    candidatas = detectar_recorrencias(
        [
            _lancamento(date(2026, 1, 10), "39.90", conta="conta-a"),
            _lancamento(date(2026, 2, 10), "39.90", conta="conta-b"),
            _lancamento(date(2026, 3, 10), "39.90", conta="conta-a"),
        ]
    )

    assert candidatas == []
