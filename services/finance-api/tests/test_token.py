"""Toda rota exige o token, gerado da lista de rotas da aplicação: rota nova
já entra no teste sem ninguém lembrar. Ver docs/specs/2026-11-10-token-na-api.md."""

import re

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from finance_api import config, main
from finance_api.main import ROTAS_SEM_TOKEN, app

sem_token = TestClient(app)
ROTAS = sorted(
    (metodo, rota.path)
    for rota in app.routes
    if isinstance(rota, APIRoute) and rota.path not in ROTAS_SEM_TOKEN
    for metodo in rota.methods
)
# A documentação interativa descreve as rotas e também fica fechada.
DOCUMENTACAO = [("GET", "/docs"), ("GET", "/openapi.json")]


def _caminho(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "1", path)


def test_a_lista_de_rotas_nao_esta_vazia() -> None:
    assert len(ROTAS) > 20


@pytest.mark.parametrize(("metodo", "path"), ROTAS + DOCUMENTACAO)
def test_rota_sem_token_responde_401(metodo: str, path: str) -> None:
    resposta = sem_token.request(metodo, _caminho(path))

    assert resposta.status_code == 401
    assert resposta.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(("metodo", "path"), ROTAS)
def test_rota_com_token_errado_responde_401(metodo: str, path: str) -> None:
    resposta = sem_token.request(metodo, _caminho(path), headers={"Authorization": "Bearer outro-token"})

    assert resposta.status_code == 401


def test_token_sem_o_prefixo_bearer_e_recusado() -> None:
    resposta = sem_token.get("/resumo", headers={"Authorization": config.FINANCE_API_TOKEN})

    assert resposta.status_code == 401


def test_health_responde_sem_token() -> None:
    assert sem_token.get("/health").status_code == 200


def test_sem_token_configurado_tudo_e_recusado(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "FINANCE_API_TOKEN", None)

    resposta = sem_token.get("/resumo", headers={"Authorization": "Bearer "})

    assert resposta.status_code == 401


def test_api_nao_sobe_sem_token_configurado(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "FINANCE_API_TOKEN", "")

    with pytest.raises(RuntimeError, match="FINANCE_API_TOKEN"):
        main.exigir_token_configurado()
