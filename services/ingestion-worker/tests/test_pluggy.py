"""Testa o cliente da Pluggy com resposta mockada, nunca a API real (evita
gastar cota em CI e em toda execução local de teste)."""

import httpx
import pytest
from ingestion_worker import pluggy


def _resposta(json_body: dict, status_code: int = 200) -> httpx.Response:
    return httpx.Response(status_code, json=json_body, request=httpx.Request("GET", "https://api.pluggy.ai"))


def test_autenticar_devolve_a_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    def _post_falso(url, json, timeout):
        assert json == {"clientId": "id", "clientSecret": "segredo"}
        return _resposta({"apiKey": "chave-123"})

    monkeypatch.setattr(pluggy.httpx, "post", _post_falso)

    assert pluggy.autenticar("id", "segredo") == "chave-123"


def test_listar_contas_devolve_os_resultados(monkeypatch: pytest.MonkeyPatch) -> None:
    def _get_falso(url, params, headers, timeout):
        assert params == {"itemId": "item-1"}
        return _resposta({"results": [{"id": "conta-1", "type": "BANK"}]})

    monkeypatch.setattr(pluggy.httpx, "get", _get_falso)

    contas = pluggy.listar_contas("chave", "item-1")

    assert contas == [{"id": "conta-1", "type": "BANK"}]


def test_listar_transacoes_segue_a_paginacao_por_cursor(monkeypatch: pytest.MonkeyPatch) -> None:
    respostas = [
        {
            "results": [{"id": "t1"}, {"id": "t2"}],
            "next": "?accountId=conta-1&after=CURSOR_ABC",
        },
        {"results": [{"id": "t3"}]},
    ]

    def _get_falso(url, params, headers, timeout):
        assert headers == {"X-API-KEY": "chave"}
        return _resposta(respostas.pop(0))

    monkeypatch.setattr(pluggy.httpx, "get", _get_falso)

    transacoes = pluggy.listar_transacoes("chave", "conta-1")

    assert [t["id"] for t in transacoes] == ["t1", "t2", "t3"]


@pytest.mark.parametrize(
    ("transacao", "tipo_esperado", "valor_esperado"),
    [
        (
            {
                "id": "d1",
                "accountId": "conta-nubank-corrente",
                "date": "2026-08-29T13:13:45.216Z",
                "description": "Compra no débito|SESC BAURU",
                "amount": -12,
                "category": "Shopping",
            },
            "despesa",
            12.0,
        ),
        (
            {
                "id": "c1",
                "accountId": "conta-nubank-corrente",
                "date": "2026-08-28T21:11:50.804Z",
                "description": "Pagamento recebido|Cliente Genux",
                "amount": 850.0,
                "category": "Business income",
            },
            "receita",
            850.0,
        ),
        (
            {
                "id": "s1",
                "accountId": "conta-mercadopago-corrente",
                "date": "2026-08-28T21:11:50.804Z",
                "description": "Transferência Recebida|Leonardo Colacio Nicolau",
                "amount": 23.9,
                "category": "Same person transfer",
            },
            "aporte_titular",
            23.9,
        ),
        (
            {
                "id": "s2",
                "accountId": "conta-nubank-corrente",
                "date": "2026-08-28T21:11:50.804Z",
                "description": "Transferência enviada|Leonardo Colacio Nicolau",
                "amount": -200.0,
                "category": "Same person transfer",
            },
            "retirada_titular",
            200.0,
        ),
    ],
)
def test_mapear_para_movimento(transacao: dict, tipo_esperado: str, valor_esperado: float) -> None:
    movimento = pluggy.mapear_para_movimento(transacao)

    assert movimento["conta_id"] == transacao["accountId"]
    assert movimento["tipo"] == tipo_esperado
    assert movimento["valor"] == valor_esperado
    assert movimento["data"] == "2026-08-29" or movimento["data"] == "2026-08-28"
    assert movimento["identificador_externo"] == transacao["id"]
    assert movimento["descricao"] == transacao["description"]


def test_mapear_conta_corrente() -> None:
    conta = {
        "id": "conta-nubank-corrente",
        "type": "BANK",
        "subtype": "CHECKING_ACCOUNT",
        "name": "Nu Pagamentos S.A.",
        "marketingName": "Nu Pagamentos S.A. (Conta Pré-paga)",
        "balance": 480.20,
        "creditData": None,
    }

    resultado = pluggy.mapear_conta(conta)

    assert resultado == {
        "id": "conta-nubank-corrente",
        "nome": "Nu Pagamentos S.A. (Conta Pré-paga)",
        "tipo": "BANK",
        "saldo": 480.20,
        "limite": None,
        "disponivel": None,
    }


def test_mapear_conta_cartao_de_credito() -> None:
    conta = {
        "id": "conta-nubank-cartao",
        "type": "CREDIT",
        "subtype": "CREDIT_CARD",
        "name": "gold",
        "marketingName": None,
        "balance": 340.04,
        "creditData": {"creditLimit": 350.0, "availableCreditLimit": 9.96},
    }

    resultado = pluggy.mapear_conta(conta)

    assert resultado == {
        "id": "conta-nubank-cartao",
        "nome": "gold",
        "tipo": "CREDIT",
        "saldo": 340.04,
        "limite": 350.0,
        "disponivel": 9.96,
    }
