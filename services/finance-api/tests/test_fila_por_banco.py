"""A fila de cada ambiente é a do banco que ele usa, e a suíte nunca usa a do
banco real. Ver docs/specs/2026-11-12-senha-do-painel.md, registro de 12/11."""

from finance_api import fila, main
from finance_api.config import DATABASE_URL


def test_nome_da_fila_vem_do_banco() -> None:
    real = "postgresql+asyncpg://mercurio:mercurio@127.0.0.1:5432/mercurio"
    teste = "postgresql+asyncpg://mercurio:mercurio@127.0.0.1:5432/mercurio_test"

    assert fila.nome_da_fila(real) == "mercurio:mercurio"
    assert fila.nome_da_fila(teste) == "mercurio:mercurio_test"
    assert fila.nome_da_fila(real) != fila.nome_da_fila(teste)


def test_a_suite_nao_enfileira_na_fila_do_banco_configurado() -> None:
    assert main.fila.name != fila.nome_da_fila(DATABASE_URL)
