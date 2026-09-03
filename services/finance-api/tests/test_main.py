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
