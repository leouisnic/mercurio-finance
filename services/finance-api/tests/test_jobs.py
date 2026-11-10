"""Testa job_sincronizar_pluggy com o cliente da Pluggy mockado (nunca a
API real) e gravando no banco de teste (nunca o de desenvolvimento)."""

import asyncio

import pandas as pd
import pytest
from finance_api import jobs
from finance_api.config import TEST_DATABASE_URL
from finance_api.jobs import job_sincronizar_pluggy
from finance_api.models import (
    CategoriaORM,
    MovimentoORM,
    MovimentoRemovidoORM,
    MovimentoTagORM,
    TagORM,
)
from ingestion_worker import pluggy
from ingestion_worker.extrato import processar_movimentos
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

pytestmark = pytest.mark.usefixtures("banco_de_teste_limpo")

CONTA_NUBANK = {
    "id": "conta-nubank",
    "type": "BANK",
    "name": "Nu Pagamentos",
    "marketingName": "Nubank",
    "balance": 480.20,
    "creditData": None,
}
TRANSACOES_NUBANK = [
    {
        "id": "txn-1",
        "accountId": "conta-nubank",
        "date": "2026-08-05T10:00:00.000Z",
        "description": "Pagamento cliente fictício",
        "amount": 2500.0,
        "type": "CREDIT",
        "category": "Business income",
    },
    {
        "id": "txn-2",
        "accountId": "conta-nubank",
        "date": "2026-08-08T10:00:00.000Z",
        "description": "Transferencia para Mercado Pago",
        "amount": -500.0,
        "type": "DEBIT",
        "category": "Same person transfer",
    },
]
CONTA_MERCADOPAGO = {
    "id": "conta-mercadopago",
    "type": "BANK",
    "name": "Mercado Pago",
    "marketingName": "Mercado Pago",
    "balance": 168.63,
    "creditData": None,
}
TRANSACOES_MERCADOPAGO = [
    {
        "id": "txn-3",
        "accountId": "conta-mercadopago",
        "date": "2026-08-08T10:00:00.000Z",
        "description": "Transferencia recebida do Nubank",
        "amount": 500.0,
        "type": "CREDIT",
        "category": "Same person transfer",
    },
]


def _configurar_mocks(monkeypatch: pytest.MonkeyPatch, sessao_de_teste_factory) -> None:
    monkeypatch.setattr(jobs, "async_session", sessao_de_teste_factory)
    monkeypatch.setattr(jobs, "PLUGGY_CLIENT_ID", "id-de-teste")
    monkeypatch.setattr(jobs, "PLUGGY_CLIENT_SECRET", "segredo-de-teste")
    monkeypatch.setattr(jobs, "PLUGGY_ITEM_IDS", ["item-nubank", "item-mercadopago"])

    monkeypatch.setattr(pluggy, "autenticar", lambda client_id, client_secret: "chave-falsa")

    def _listar_contas_falso(api_key, item_id):
        return [CONTA_NUBANK] if item_id == "item-nubank" else [CONTA_MERCADOPAGO]

    def _listar_transacoes_falso(api_key, account_id):
        return TRANSACOES_NUBANK if account_id == CONTA_NUBANK["id"] else TRANSACOES_MERCADOPAGO

    monkeypatch.setattr(pluggy, "listar_contas", _listar_contas_falso)
    monkeypatch.setattr(pluggy, "listar_transacoes", _listar_transacoes_falso)


def test_job_sincronizar_pluggy_grava_contas_e_movimentos(
    monkeypatch: pytest.MonkeyPatch, sessao_de_teste_factory
) -> None:
    _configurar_mocks(monkeypatch, sessao_de_teste_factory)

    resultado = job_sincronizar_pluggy()

    assert resultado == {
        "contas": 2,
        "transacoes_encontradas": 3,
        "inseridos": 3,
        "removidos_pela_pluggy": 0,
        "aguardando_conversao": 0,
        # Nenhuma conta de cartão nas fixtures, nada para casar.
        "pagamentos_de_fatura_detectados": 0,
        # Três transações espalhadas, nenhuma repetida mês a mês: a
        # detecção roda mas não tem o que sugerir.
        "recorrencias_detectadas": 0,
    }


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


def test_dois_jobs_seguidos_no_mesmo_processo(
    monkeypatch: pytest.MonkeyPatch, sessao_de_teste_factory
) -> None:
    """O worker é um processo longo que roda vários jobs em sequência.

    Este teste usa um engine COM pool de propósito: as outras fixtures usam
    NullPool, que já contorna o problema e esconderia a regressão. Cada job
    abre um event loop próprio (`asyncio.run`), e a conexão asyncpg fica
    presa ao loop em que nasceu, então o segundo job pegaria uma conexão
    morta se `jobs.rodar` não descartasse o pool no fim de cada um.
    """
    _configurar_mocks(monkeypatch, sessao_de_teste_factory)

    engine_com_pool = create_async_engine(TEST_DATABASE_URL)
    monkeypatch.setattr(jobs, "engine", engine_com_pool)
    monkeypatch.setattr(jobs, "async_session", async_sessionmaker(engine_com_pool))

    assert job_sincronizar_pluggy()["contas"] == 2
    assert job_sincronizar_pluggy()["contas"] == 2


# A Pluggy altera e apaga transações já entregues. Ver
# docs/specs/2026-11-10-numeros-leva-2.md.


def _sincronizar_com(monkeypatch, sessao_de_teste_factory, nubank: list[dict], mercadopago: list[dict]) -> dict:
    _configurar_mocks(monkeypatch, sessao_de_teste_factory)
    monkeypatch.setattr(
        pluggy, "listar_transacoes", lambda api_key, conta: nubank if conta == CONTA_NUBANK["id"] else mercadopago
    )
    return job_sincronizar_pluggy()


def _linhas(sessao_de_teste_factory, modelo=MovimentoORM):
    async def ler():
        async with sessao_de_teste_factory() as sessao:
            return (await sessao.execute(select(modelo))).scalars().all()

    return asyncio.run(ler())


def _categorizar_e_marcar(sessao_de_teste_factory, identificador: str) -> tuple[str, int]:
    """O dono escolhe uma categoria e põe uma tag na linha."""

    async def gravar():
        async with sessao_de_teste_factory() as sessao:
            categoria = (await sessao.execute(select(CategoriaORM.id).order_by(CategoriaORM.ordem))).scalars().first()
            movimento = (
                await sessao.execute(select(MovimentoORM).where(MovimentoORM.identificador_externo == identificador))
            ).scalar_one()
            movimento.categoria_propria = categoria
            movimento.origem_da_categoria = "dono"
            tag = TagORM(nome="Viagem fictícia")
            sessao.add(tag)
            await sessao.flush()
            sessao.add(MovimentoTagORM(movimento_id=movimento.id, tag_id=tag.id))
            await sessao.commit()
            return categoria, tag.id

    return asyncio.run(gravar())


def _tags_de(sessao_de_teste_factory, movimento_id: int) -> list[int]:
    async def ler():
        async with sessao_de_teste_factory() as sessao:
            consulta = select(MovimentoTagORM.tag_id).where(MovimentoTagORM.movimento_id == movimento_id)
            return list((await sessao.execute(consulta)).scalars().all())

    return asyncio.run(ler())


def test_transacao_alterada_pela_pluggy_atualiza_a_mesma_linha(monkeypatch, sessao_de_teste_factory) -> None:
    """De pendente para lançada a data e o valor mudam e o ID fica. Antes,
    o fingerprint novo gravava uma segunda linha e o gasto contava duas."""
    _sincronizar_com(monkeypatch, sessao_de_teste_factory, TRANSACOES_NUBANK, TRANSACOES_MERCADOPAGO)
    categoria, tag = _categorizar_e_marcar(sessao_de_teste_factory, "txn-2")
    alterada = {**TRANSACOES_NUBANK[1], "date": "2026-08-09T10:00:00.000Z", "amount": -510.0}

    resultado = _sincronizar_com(
        monkeypatch, sessao_de_teste_factory, [TRANSACOES_NUBANK[0], alterada], TRANSACOES_MERCADOPAGO
    )

    linhas = [linha for linha in _linhas(sessao_de_teste_factory) if linha.identificador_externo == "txn-2"]
    assert resultado["inseridos"] == 0
    assert len(linhas) == 1
    assert str(linhas[0].data) == "2026-08-09"
    assert str(linhas[0].valor) == "510.00"
    assert linhas[0].categoria_propria == categoria
    assert _tags_de(sessao_de_teste_factory, linhas[0].id) == [tag]


def test_transacao_apagada_pela_pluggy_sai_das_somas_e_volta_com_as_escolhas(
    monkeypatch, sessao_de_teste_factory
) -> None:
    _sincronizar_com(monkeypatch, sessao_de_teste_factory, TRANSACOES_NUBANK, TRANSACOES_MERCADOPAGO)
    categoria, tag = _categorizar_e_marcar(sessao_de_teste_factory, "txn-2")
    id_original = next(l.id for l in _linhas(sessao_de_teste_factory) if l.identificador_externo == "txn-2")

    sumiu = _sincronizar_com(monkeypatch, sessao_de_teste_factory, [TRANSACOES_NUBANK[0]], TRANSACOES_MERCADOPAGO)

    assert sumiu["removidos_pela_pluggy"] == 1
    assert "txn-2" not in {linha.identificador_externo for linha in _linhas(sessao_de_teste_factory)}
    removida = _linhas(sessao_de_teste_factory, MovimentoRemovidoORM)
    assert [linha.identificador_externo for linha in removida] == ["txn-2"]

    voltou = _sincronizar_com(monkeypatch, sessao_de_teste_factory, TRANSACOES_NUBANK, TRANSACOES_MERCADOPAGO)

    linha = next(l for l in _linhas(sessao_de_teste_factory) if l.identificador_externo == "txn-2")
    assert voltou["inseridos"] == 0
    assert linha.id == id_original
    assert linha.categoria_propria == categoria
    assert _tags_de(sessao_de_teste_factory, linha.id) == [tag]
    assert _linhas(sessao_de_teste_factory, MovimentoRemovidoORM) == []


def test_conta_sem_transacao_devolvida_nao_remove_nada(monkeypatch, sessao_de_teste_factory) -> None:
    """Falha ou resposta vazia da Pluggy não pode esvaziar o histórico."""
    _sincronizar_com(monkeypatch, sessao_de_teste_factory, TRANSACOES_NUBANK, TRANSACOES_MERCADOPAGO)

    resultado = _sincronizar_com(monkeypatch, sessao_de_teste_factory, [], TRANSACOES_MERCADOPAGO)

    assert resultado["removidos_pela_pluggy"] == 0
    assert len(_linhas(sessao_de_teste_factory)) == 3


def test_linha_mais_antiga_que_o_devolvido_fica(monkeypatch, sessao_de_teste_factory) -> None:
    """A Pluggy guarda doze meses: o que ficou antes da data mais antiga que
    ela devolveu saiu do histórico dela, não foi apagado."""
    _sincronizar_com(monkeypatch, sessao_de_teste_factory, TRANSACOES_NUBANK, TRANSACOES_MERCADOPAGO)

    resultado = _sincronizar_com(monkeypatch, sessao_de_teste_factory, [TRANSACOES_NUBANK[1]], TRANSACOES_MERCADOPAGO)

    assert resultado["removidos_pela_pluggy"] == 0
    assert "txn-1" in {linha.identificador_externo for linha in _linhas(sessao_de_teste_factory)}


def test_compra_em_dolar_entra_em_reais_e_sem_conversao_espera(monkeypatch, sessao_de_teste_factory) -> None:
    """Fictício: USD 12,00 cobrados como R$ 60,00."""
    em_dolar = {
        "id": "txn-usd",
        "accountId": "conta-nubank",
        "date": "2026-08-07T10:00:00.000Z",
        "description": "Assinatura fictícia",
        "amount": -12.0,
        "amountInAccountCurrency": -60.0,
        "currencyCode": "USD",
        "type": "DEBIT",
        "category": "Video streaming",
    }
    sem_conversao = {**em_dolar, "id": "txn-usd-2", "amountInAccountCurrency": None}

    resultado = _sincronizar_com(
        monkeypatch, sessao_de_teste_factory, [*TRANSACOES_NUBANK, em_dolar, sem_conversao], TRANSACOES_MERCADOPAGO
    )

    linha = next(l for l in _linhas(sessao_de_teste_factory) if l.identificador_externo == "txn-usd")
    assert (str(linha.valor), linha.moeda_original, str(linha.valor_original)) == ("60.00", "USD", "12.00")
    assert resultado["aguardando_conversao"] == 1
    assert "txn-usd-2" not in {l.identificador_externo for l in _linhas(sessao_de_teste_factory)}


def test_despesa_igual_de_outra_origem_fica_como_possivel_duplicidade(
    monkeypatch, sessao_de_teste_factory, semear_movimentos
) -> None:
    """R4: a comparação era só dentro do lote. A Pluggy devolve o histórico
    inteiro a cada vez, então o lote já cruza Pluggy com Pluggy; o que ficava
    de fora é a linha de outra origem, como um extrato importado. As duas
    ficam marcadas e continuam no total."""
    despesa = {
        "id": "txn-4",
        "accountId": "conta-nubank",
        "date": "2026-08-10T10:00:00.000Z",
        "description": "Mercado fictício",
        "amount": -100.0,
        "type": "DEBIT",
        "category": "Groceries",
    }
    _sincronizar_com(monkeypatch, sessao_de_teste_factory, TRANSACOES_NUBANK, TRANSACOES_MERCADOPAGO)
    semear_movimentos(
        processar_movimentos(
            pd.DataFrame(
                [
                    {
                        "data": "2026-08-10",
                        "valor": 100.0,
                        "descricao": "Mercado fictício",
                        "conta_id": "conta-nubank",
                        "tipo": "despesa",
                        "identificador_externo": "linha-7",
                    }
                ]
            )
        ),
        "csv",
    )

    _sincronizar_com(monkeypatch, sessao_de_teste_factory, [*TRANSACOES_NUBANK, despesa], TRANSACOES_MERCADOPAGO)

    iguais = [l for l in _linhas(sessao_de_teste_factory) if l.descricao == "Mercado fictício"]
    assert len(iguais) == 2
    assert all(linha.duplicado_possivel for linha in iguais)
