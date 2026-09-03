import pytest
from fastapi.testclient import TestClient
from finance_api.main import app
from finance_api.seed import EXTRATO_FICTICIO
from ingestion_worker.extrato import carregar_extrato
from mercurio_domain import Proveniencia

client = TestClient(app)

# Todo teste deste arquivo toca o banco de teste; os de test_domain.py não.
pytestmark = pytest.mark.usefixtures("banco_de_teste_limpo")


def test_health() -> None:
    resposta = client.get("/health")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_resumo_sem_movimentos_traz_pf_e_pj_zerados() -> None:
    resposta = client.get("/resumo")
    assert resposta.status_code == 200

    corpo = resposta.json()
    titularidades = {item["titularidade"] for item in corpo["titularidades"]}
    assert titularidades == {"pf", "pj"}
    saldos = {item["titularidade"]: item["saldo"] for item in corpo["titularidades"]}
    assert saldos == {"pf": "0.00", "pj": "0.00"}
    assert corpo["obrigacao_das"]["valor"] == "86.05"
    assert corpo["obrigacao_das"]["paga"] is False


def test_das_pagar_marca_a_competencia_atual_como_paga() -> None:
    antes = client.get("/resumo").json()
    assert antes["obrigacao_das"]["paga"] is False

    resposta = client.post("/das/pagar")
    assert resposta.status_code == 200
    assert resposta.json()["paga"] is True

    depois = client.get("/resumo").json()
    assert depois["obrigacao_das"]["paga"] is True


def test_das_pagar_e_idempotente() -> None:
    assert client.post("/das/pagar").status_code == 200
    assert client.post("/das/pagar").status_code == 200

    assert client.get("/resumo").json()["obrigacao_das"]["paga"] is True


def test_resumo_calcula_o_saldo_a_partir_dos_movimentos_gravados(semear_movimentos) -> None:
    """Regressão: o saldo já foi hardcoded direto na resposta, sem nenhuma
    agregação real por trás. Estes valores vêm de somar o extrato fictício
    à mão, não do próprio endpoint."""
    extrato = carregar_extrato(EXTRATO_FICTICIO)
    semear_movimentos(extrato, Proveniencia.IMPORTACAO_MANUAL.value)

    resposta = client.get("/resumo")
    saldos = {
        item["titularidade"]: item["saldo"] for item in resposta.json()["titularidades"]
    }

    # pj: 2500 (Genux) + 850 (Tragial) - 300 (ferramenta) - 500 (retirada)
    #     + 420 (serviço avulso) - 71.60 (DAS pago) = 2898.40
    assert saldos["pj"] == "2898.40"
    # pf: 500 (aporte, espelha a retirada da pj) - 180.50 (mercado) - 65 (streaming) = 254.50
    assert saldos["pf"] == "254.50"


def test_reimportar_o_mesmo_extrato_nao_duplica_o_saldo(semear_movimentos) -> None:
    extrato = carregar_extrato(EXTRATO_FICTICIO)
    semear_movimentos(extrato, Proveniencia.IMPORTACAO_MANUAL.value)
    semear_movimentos(extrato, Proveniencia.IMPORTACAO_MANUAL.value)

    resposta = client.get("/resumo")
    saldos = {
        item["titularidade"]: item["saldo"] for item in resposta.json()["titularidades"]
    }

    assert saldos["pj"] == "2898.40"
    assert saldos["pf"] == "254.50"
