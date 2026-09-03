import pytest
from fastapi.testclient import TestClient
from finance_api.main import app
from finance_api.seed import EXTRATO_FICTICIO, seed_contas_ficticias
from ingestion_worker.extrato import carregar_extrato
from mercurio_domain import Proveniencia

client = TestClient(app)

# Todo teste deste arquivo toca o banco de teste; os de test_domain.py não.
pytestmark = pytest.mark.usefixtures("banco_de_teste_limpo")


def test_health() -> None:
    resposta = client.get("/health")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_resumo_sem_contas_traz_lista_vazia() -> None:
    resposta = client.get("/resumo")
    assert resposta.status_code == 200
    assert resposta.json()["contas"] == []


def test_resumo_traz_o_saldo_que_esta_gravado_na_conta(semear_contas) -> None:
    """O saldo mostrado vem direto da tabela `contas` (o que a Pluggy
    relata), não de somar movimentos: por isso basta gravar a conta, sem
    nenhum movimento, para o saldo já aparecer certo."""
    semear_contas(
        [
            {"id": "conta-corrente", "nome": "Banco X", "tipo": "BANK", "saldo": 480.20},
            {
                "id": "conta-cartao",
                "nome": "Cartão gold",
                "tipo": "CREDIT",
                "saldo": 340.04,
                "limite": 350.0,
                "disponivel": 9.96,
            },
        ]
    )

    resposta = client.get("/resumo")
    contas = {c["id"]: c for c in resposta.json()["contas"]}

    assert contas["conta-corrente"]["saldo"] == "480.20"
    assert contas["conta-corrente"]["limite"] is None
    assert contas["conta-cartao"]["saldo"] == "340.04"
    assert contas["conta-cartao"]["limite"] == "350.00"
    assert contas["conta-cartao"]["disponivel"] == "9.96"


def test_resincronizar_atualiza_o_saldo_da_mesma_conta(semear_contas) -> None:
    semear_contas([{"id": "conta-a", "nome": "Banco X", "tipo": "BANK", "saldo": 100.00}])
    semear_contas([{"id": "conta-a", "nome": "Banco X", "tipo": "BANK", "saldo": 250.00}])

    resposta = client.get("/resumo")
    contas = resposta.json()["contas"]

    assert len(contas) == 1
    assert contas[0]["saldo"] == "250.00"


def test_movimentos_do_seed_ficticio_sao_gravados_ligados_as_contas(
    semear_contas, semear_movimentos
) -> None:
    """Regressão: os movimentos precisam de uma conta já existente
    (chave estrangeira); confere que o caminho completo (contas +
    movimentos) funciona, não só o resumo."""
    semear_contas(seed_contas_ficticias())
    extrato = carregar_extrato(EXTRATO_FICTICIO)
    inseridos = semear_movimentos(extrato, Proveniencia.IMPORTACAO_MANUAL.value)

    assert inseridos == 9
