"""Testa job_sincronizar_pluggy com o cliente da Pluggy mockado (nunca a
API real) e gravando no banco de teste (nunca o de desenvolvimento)."""

import pytest
from finance_api import jobs
from finance_api.jobs import job_sincronizar_pluggy
from ingestion_worker import pluggy

pytestmark = pytest.mark.usefixtures("banco_de_teste_limpo")

# As duas contas conectadas no Pluggy hoje são PF (Nubank e Mercado Pago).
CONTA_NUBANK = {"id": "conta-nubank", "type": "BANK"}
TRANSACOES_NUBANK = [
    {
        "id": "txn-1",
        "date": "2026-08-05T10:00:00.000Z",
        "description": "Pagamento cliente Genux",
        "amount": 2500.0,
        "category": "Business income",
    },
    {
        "id": "txn-2",
        "date": "2026-08-08T10:00:00.000Z",
        "description": "Transferencia para Mercado Pago",
        "amount": -500.0,
        "category": "Same person transfer",
    },
]
CONTA_MERCADOPAGO = {"id": "conta-mercadopago", "type": "BANK"}
TRANSACOES_MERCADOPAGO = [
    {
        "id": "txn-3",
        "date": "2026-08-08T10:00:00.000Z",
        "description": "Transferencia recebida do Nubank",
        "amount": 500.0,
        "category": "Same person transfer",
    },
]


def _configurar_mocks(monkeypatch: pytest.MonkeyPatch, sessao_de_teste_factory) -> None:
    monkeypatch.setattr(jobs, "async_session", sessao_de_teste_factory)
    monkeypatch.setattr(jobs, "PLUGGY_CLIENT_ID", "id-de-teste")
    monkeypatch.setattr(jobs, "PLUGGY_CLIENT_SECRET", "segredo-de-teste")
    monkeypatch.setattr(
        jobs, "CONTAS_PLUGGY", [("item-nubank", "pf"), ("item-mercadopago", "pf")]
    )

    monkeypatch.setattr(pluggy, "autenticar", lambda client_id, client_secret: "chave-falsa")

    def _listar_contas_falso(api_key, item_id):
        return [CONTA_NUBANK] if item_id == "item-nubank" else [CONTA_MERCADOPAGO]

    def _listar_transacoes_falso(api_key, account_id):
        return TRANSACOES_NUBANK if account_id == CONTA_NUBANK["id"] else TRANSACOES_MERCADOPAGO

    monkeypatch.setattr(pluggy, "listar_contas", _listar_contas_falso)
    monkeypatch.setattr(pluggy, "listar_transacoes", _listar_transacoes_falso)


def test_job_sincronizar_pluggy_grava_movimentos_reais(
    monkeypatch: pytest.MonkeyPatch, sessao_de_teste_factory, semear_movimentos
) -> None:
    _configurar_mocks(monkeypatch, sessao_de_teste_factory)

    resultado = job_sincronizar_pluggy()

    assert resultado == {"contas": 2, "transacoes_encontradas": 3, "inseridos": 3}


def test_job_sincronizar_pluggy_e_idempotente(
    monkeypatch: pytest.MonkeyPatch, sessao_de_teste_factory
) -> None:
    _configurar_mocks(monkeypatch, sessao_de_teste_factory)

    primeiro = job_sincronizar_pluggy()
    segundo = job_sincronizar_pluggy()

    assert primeiro["inseridos"] == 3
    assert segundo["inseridos"] == 0


def test_job_sincronizar_pluggy_sem_credenciais_leva_erro_claro(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(jobs, "PLUGGY_CLIENT_ID", None)

    with pytest.raises(RuntimeError, match="Credenciais do Pluggy"):
        job_sincronizar_pluggy()
