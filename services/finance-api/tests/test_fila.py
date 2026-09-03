"""Testa a fila do Redis de ponta a ponta: enfileira via HTTP, processa com
SimpleWorker (mesmo processo, sem fork, funciona no Windows) e confere o
resultado. Usa fila e banco próprios de teste, nunca a fila nem o banco de
desenvolvimento (`finance_api.jobs.async_session` é trocado pelo
sessionmaker de teste; sem isso, o job gravaria no banco real).
"""

import pytest
from fastapi.testclient import TestClient
from finance_api.config import REDIS_URL
from finance_api.jobs import job_reimportar_seed
from finance_api.main import app
from redis import Redis
from rq import Queue, SimpleWorker

pytestmark = pytest.mark.usefixtures("banco_de_teste_limpo")

client = TestClient(app)


@pytest.fixture
def fila_de_teste(monkeypatch, sessao_de_teste_factory):
    monkeypatch.setattr("finance_api.jobs.async_session", sessao_de_teste_factory)

    conexao = Redis.from_url(REDIS_URL)
    fila = Queue("mercurio-teste", connection=conexao)
    fila.empty()

    monkeypatch.setattr("finance_api.main.fila", fila)

    yield fila

    fila.empty()


def test_sync_seed_enfileira_e_processa(fila_de_teste) -> None:
    resposta = client.post("/sync/seed")
    assert resposta.status_code == 202
    job_id = resposta.json()["job_id"]
    assert resposta.json()["status"] == "queued"

    worker = SimpleWorker([fila_de_teste], connection=fila_de_teste.connection)
    worker.work(burst=True)

    status = client.get(f"/sync/{job_id}")
    assert status.status_code == 200
    corpo = status.json()
    assert corpo["status"] == "finished"
    assert corpo["resultado"] == 9  # linhas do extrato fictício


def test_status_de_job_inexistente_devolve_404() -> None:
    resposta = client.get("/sync/job-que-nao-existe")
    assert resposta.status_code == 404


def test_job_reimportar_seed_e_idempotente(monkeypatch, sessao_de_teste_factory) -> None:
    monkeypatch.setattr("finance_api.jobs.async_session", sessao_de_teste_factory)

    primeira = job_reimportar_seed()
    segunda = job_reimportar_seed()

    assert primeira == 9
    assert segunda == 0
