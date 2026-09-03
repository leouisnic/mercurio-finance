"""Fixtures compartilhadas: os testes rodam contra TEST_DATABASE_URL, nunca
contra o banco de desenvolvimento (que vai guardar dado real do Pluggy).
"""

import asyncio
from collections.abc import Callable

import pandas as pd
import pytest
from finance_api.config import TEST_DATABASE_URL
from finance_api.db import obter_sessao
from finance_api.main import app
from finance_api.models import ContaORM, MovimentoORM
from finance_api.repositorio import inserir_movimentos, upsert_contas
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# NullPool: cada teste (e o TestClient) roda em um asyncio.run() próprio, ou
# seja, um event loop novo a cada vez. Uma conexão asyncpg pooled fica presa
# ao loop em que nasceu; sem NullPool, o segundo teste reusaria uma conexão
# do loop anterior (já fechado) e o asyncpg quebra com "another operation is
# in progress".
_engine_teste = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
_sessao_teste = async_sessionmaker(_engine_teste, expire_on_commit=False)


async def _obter_sessao_teste():
    async with _sessao_teste() as sessao:
        yield sessao


app.dependency_overrides[obter_sessao] = _obter_sessao_teste


async def _limpar_movimentos() -> None:
    async with _sessao_teste() as sessao:
        # movimentos primeiro: tem chave estrangeira para contas.
        await sessao.execute(delete(MovimentoORM))
        await sessao.execute(delete(ContaORM))
        await sessao.commit()


@pytest.fixture
def banco_de_teste_limpo():
    """Não é autouse: só os testes que tocam o banco (test_main.py) pedem
    essa fixture. test_domain.py é lógica pura e não precisa pagar o custo
    de limpar o banco antes/depois."""
    asyncio.run(_limpar_movimentos())
    yield
    asyncio.run(_limpar_movimentos())


@pytest.fixture
def sessao_de_teste_factory() -> async_sessionmaker:
    """O sessionmaker do banco de teste. Use com `monkeypatch` para
    substituir `async_session` em qualquer módulo que um teste exercite
    (ex: `finance_api.jobs`), garantindo que nenhum job rodado em teste
    escreva no banco de desenvolvimento."""
    return _sessao_teste


@pytest.fixture
def semear_contas() -> Callable[[list[dict]], None]:
    """Devolve uma função síncrona que grava contas no banco de teste.
    Precisa rodar antes de `semear_movimentos` (chave estrangeira)."""

    def _semear(contas: list[dict]) -> None:
        async def gravar() -> None:
            async with _sessao_teste() as sessao:
                await upsert_contas(sessao, contas)

        asyncio.run(gravar())

    return _semear


@pytest.fixture
def semear_movimentos() -> Callable[[pd.DataFrame, str], int]:
    """Devolve uma função síncrona que grava um extrato (já processado por
    `carregar_extrato`) no banco de teste, para o teste montar o cenário
    antes de chamar o endpoint."""

    def _semear(extrato: pd.DataFrame, proveniencia: str) -> int:
        async def inserir() -> int:
            async with _sessao_teste() as sessao:
                return await inserir_movimentos(sessao, extrato, proveniencia)

        return asyncio.run(inserir())

    return _semear
