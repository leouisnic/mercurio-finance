from datetime import date
from decimal import Decimal

import pytest
from finance_api.domain import (
    Movimento,
    Proveniencia,
    TipoMovimento,
    Titularidade,
    encontrar_duplicidades,
)
from pydantic import ValidationError


def _movimento(**overrides: object) -> Movimento:
    base: dict[str, object] = {
        "titularidade": Titularidade.PJ,
        "data": date(2026, 8, 10),
        "valor": Decimal("150.00"),
        "descricao": "Pagamento cliente Genux",
        "tipo": TipoMovimento.RECEITA,
        "proveniencia": Proveniencia.EXTRATO_BANCARIO,
        "identificador_externo": "TXN123",
    }
    base.update(overrides)
    return Movimento(**base)


def test_movimentos_iguais_tem_o_mesmo_fingerprint_mesmo_com_ids_diferentes() -> None:
    primeiro = _movimento(identificador_externo="TXN123")
    segundo = _movimento(identificador_externo="TXN999")

    assert primeiro.fingerprint == segundo.fingerprint


def test_movimentos_diferentes_tem_fingerprints_diferentes() -> None:
    primeiro = _movimento(valor=Decimal("150.00"))
    segundo = _movimento(valor=Decimal("151.00"))

    assert primeiro.fingerprint != segundo.fingerprint


def test_encontrar_duplicidades_agrupa_fingerprint_e_identificador_iguais() -> None:
    duplicado_a = _movimento(identificador_externo="TXN123")
    duplicado_b = _movimento(identificador_externo="TXN123")  # mesma linha importada 2x
    unico = _movimento(descricao="Pagamento cliente Tragial", identificador_externo="TXN777")

    grupos = encontrar_duplicidades([duplicado_a, duplicado_b, unico])

    assert len(grupos) == 1
    assert len(grupos[0]) == 2


def test_mesmo_conteudo_com_identificador_diferente_nao_e_duplicidade_automatica() -> None:
    """Conteúdo igual mas identificador externo diferente é ambíguo (pode ser
    duplicidade real ou dois eventos legítimos iguais): não some do resumo
    sozinho, fica para revisão humana."""
    primeiro = _movimento(identificador_externo="TXN123")
    segundo = _movimento(identificador_externo="TXN999")

    grupos = encontrar_duplicidades([primeiro, segundo])

    assert grupos == []


def test_valor_zero_ou_negativo_e_rejeitado() -> None:
    with pytest.raises(ValidationError):
        _movimento(valor=Decimal(0))

    with pytest.raises(ValidationError):
        _movimento(valor=Decimal("-10.00"))


def test_fingerprint_e_igual_para_valor_representado_como_float_ou_decimal() -> None:
    """Regressão: finance-api e ingestion-worker já calcularam fingerprints
    diferentes para o mesmo valor por causa de arredondamento diferente."""
    via_decimal = _movimento(valor=Decimal("1500.5"))
    via_decimal_duas_casas = _movimento(valor=Decimal("1500.50"))

    assert via_decimal.fingerprint == via_decimal_duas_casas.fingerprint


def test_aporte_do_titular_tem_sinal_oposto_a_retirada() -> None:
    from mercurio_domain import SINAL_POR_TIPO

    assert SINAL_POR_TIPO[TipoMovimento.APORTE_TITULAR] == 1
    assert SINAL_POR_TIPO[TipoMovimento.RETIRADA_TITULAR] == -1
    assert TipoMovimento.APORTE_TITULAR not in (TipoMovimento.RECEITA, TipoMovimento.DESPESA)
