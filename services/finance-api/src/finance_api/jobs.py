"""Jobs processados pelo worker RQ, em outro processo.

Cada job cria sua própria sessão do banco: roda num processo separado do
`finance-api`, não pode compartilhar o engine em memória do processo web.
"""

import asyncio
from collections.abc import Callable, Coroutine

import pandas as pd
from mercurio_domain import Proveniencia

from finance_api.config import PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_ITEM_IDS
from finance_api.db import async_session, engine
from finance_api.recorrencias import detectar_recorrencias
from finance_api.repositorio import (
    inserir_movimentos,
    lancamentos_para_deteccao,
    marcar_pagamentos_de_fatura,
    salvar_recorrencias_detectadas,
    upsert_contas,
)
from finance_api.seed import EXTRATO_FICTICIO, seed_contas_ficticias


def rodar[T](corrotina: Callable[[], Coroutine[None, None, T]]) -> T:
    """Roda a parte assíncrona de um job e descarta o pool de conexões no fim.

    Cada job abre um event loop novo (`asyncio.run`), e uma conexão asyncpg
    fica presa ao loop em que nasceu. Sem o descarte, o segundo job de um
    mesmo processo pega uma conexão do loop anterior, já fechado, e quebra
    com "'NoneType' object has no attribute 'send'": o worker processaria um
    job só por processo. Mesma armadilha que tests/conftest.py resolve com
    NullPool; aqui o pool é preservado, porque no processo web ele vale a
    pena e o loop é um só.
    """

    async def com_descarte() -> T:
        try:
            return await corrotina()
        finally:
            await engine.dispose()

    return asyncio.run(com_descarte())


def job_reimportar_seed() -> int:
    """Job de exemplo para provar a fila de ponta a ponta antes de plugar o
    Pluggy de verdade (Fase B). Reimporta o extrato fictício; idempotente,
    então rodar de novo não duplica saldo."""
    from ingestion_worker.extrato import carregar_extrato

    extrato = carregar_extrato(EXTRATO_FICTICIO)

    async def inserir() -> int:
        async with async_session() as sessao:
            await upsert_contas(sessao, seed_contas_ficticias())
            return await inserir_movimentos(
                sessao, extrato, proveniencia=Proveniencia.IMPORTACAO_MANUAL.value
            )

    return rodar(inserir)


def job_sincronizar_pluggy() -> dict[str, int]:
    """Busca contas e transações reais no Pluggy (um item por banco
    conectado, `PLUGGY_ITEM_IDS`) e grava no Postgres. Só leitura na
    Pluggy; idempotente na escrita (reimportar não duplica saldo, e
    atualizar uma conta que já existe só atualiza saldo/limite).

    Inclui conta corrente e cartão de crédito de cada banco. Depois de
    gravar, roda `marcar_pagamentos_de_fatura` (para o pagamento da fatura
    não contar como gasto, já que a compra em si já está lançada) e a
    detecção de recorrência, ver `finance_api.recorrencias`. É aqui que
    chega movimento novo, então é onde os dois precisam ser reavaliados.

    O saldo mostrado no painel não depende de nada disso: vem direto do que
    a Pluggy relata para cada conta, não de somar movimentos.
    """
    from ingestion_worker.extrato import processar_movimentos
    from ingestion_worker.pluggy import (
        autenticar,
        listar_contas,
        listar_transacoes,
        mapear_conta,
        mapear_para_movimento,
    )

    if not (PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET and PLUGGY_ITEM_IDS):
        raise RuntimeError(
            "Credenciais do Pluggy não configuradas (PLUGGY_CLIENT_ID, "
            "PLUGGY_CLIENT_SECRET, PLUGGY_ITEM_IDS)."
        )

    api_key = autenticar(PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET)

    contas: list[dict] = []
    movimentos: list[dict] = []
    for item_id in PLUGGY_ITEM_IDS:
        for conta in listar_contas(api_key, item_id):
            contas.append(mapear_conta(conta))
            for transacao in listar_transacoes(api_key, conta["id"]):
                movimentos.append(mapear_para_movimento(transacao))

    async def gravar() -> tuple[int, int, int]:
        async with async_session() as sessao:
            await upsert_contas(sessao, contas)

            inseridos = 0
            if movimentos:
                extrato = processar_movimentos(pd.DataFrame(movimentos))
                inseridos = await inserir_movimentos(
                    sessao, extrato, proveniencia=Proveniencia.PLUGGY.value
                )

            # Antes da detecção, de propósito: pagamento de fatura marcado
            # aqui sai da conta de despesa e não vira recorrência falsa.
            faturas = await marcar_pagamentos_de_fatura(sessao)
            candidatas = detectar_recorrencias(await lancamentos_para_deteccao(sessao))
            recorrencias = await salvar_recorrencias_detectadas(sessao, candidatas)
            return inseridos, faturas, recorrencias

    inseridos, faturas, recorrencias = rodar(gravar)
    return {
        "contas": len(contas),
        "transacoes_encontradas": len(movimentos),
        "inseridos": inseridos,
        "pagamentos_de_fatura_detectados": faturas,
        "recorrencias_detectadas": recorrencias,
    }
