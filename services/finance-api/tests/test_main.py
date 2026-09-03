from fastapi.testclient import TestClient
from finance_api.main import app

client = TestClient(app)


def test_health() -> None:
    resposta = client.get("/health")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_resumo_traz_as_tres_titularidades() -> None:
    resposta = client.get("/resumo")
    assert resposta.status_code == 200

    corpo = resposta.json()
    titularidades = {item["titularidade"] for item in corpo["titularidades"]}
    assert titularidades == {"pf", "pj", "mei"}
    assert corpo["reserva_das"]["valor_reservado"] == "620.00"
    assert corpo["reserva_das"]["valor_previsto"] == "650.00"


def test_resumo_calcula_o_saldo_a_partir_do_extrato_ficticio() -> None:
    """Regressão: o saldo já foi hardcoded direto na resposta, sem
    nenhuma agregação real por trás. Estes valores vêm de somar
    `dados/extrato_ficticio.csv` à mão, não do próprio endpoint."""
    resposta = client.get("/resumo")
    saldos = {
        item["titularidade"]: item["saldo"] for item in resposta.json()["titularidades"]
    }

    # pj: 2500 (Genux) + 850 (Tragial) - 300 (ferramenta) - 500 (retirada) = 2550.00
    assert saldos["pj"] == "2550.00"
    # pf: 500 (aporte, espelha a retirada da pj) - 180.50 (mercado) - 65 (streaming) = 254.50
    assert saldos["pf"] == "254.50"
    # mei: 420 (serviço avulso) - 71.60 (taxa) = 348.40
    assert saldos["mei"] == "348.40"
