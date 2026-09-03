"""Cliente da API do Pluggy (Open Finance), somente leitura.

Nenhuma chamada de escrita é feita aqui: só autenticação, contas e
transações. Ver docs/domain-rules.md e docs/security.md.
"""

from __future__ import annotations

from datetime import datetime
from urllib.parse import parse_qs, urlparse

import httpx

BASE_URL = "https://api.pluggy.ai"

# Pluggy já classifica transferência entre contas do mesmo titular; usamos
# essa categoria para mapear para retirada_titular/aporte_titular em vez de
# despesa/receita, em vez de tentar adivinhar pela descrição.
CATEGORIA_TRANSFERENCIA_PROPRIA = "Same person transfer"


def autenticar(client_id: str, client_secret: str) -> str:
    """Troca clientId/clientSecret por um apiKey de curta duração."""
    resposta = httpx.post(
        f"{BASE_URL}/auth",
        json={"clientId": client_id, "clientSecret": client_secret},
        timeout=30,
    )
    resposta.raise_for_status()
    return resposta.json()["apiKey"]


def listar_contas(api_key: str, item_id: str) -> list[dict]:
    """Lista as contas (corrente, poupança, cartão etc) de um item
    (conexão bancária) já existente."""
    resposta = httpx.get(
        f"{BASE_URL}/accounts",
        params={"itemId": item_id},
        headers={"X-API-KEY": api_key},
        timeout=30,
    )
    resposta.raise_for_status()
    return resposta.json()["results"]


def listar_transacoes(api_key: str, account_id: str, limite_paginas: int = 50) -> list[dict]:
    """Lista todas as transações de uma conta.

    `/transactions` (paginação por página/tamanho) está descontinuado pelo
    Pluggy (HTTP 410); `/v2/transactions` usa paginação por cursor: cada
    resposta traz `next`, uma querystring para a próxima página, até não
    haver mais.
    """
    todas: list[dict] = []
    parametros: dict[str, str] = {"accountId": account_id}

    for _ in range(limite_paginas):
        resposta = httpx.get(
            f"{BASE_URL}/v2/transactions",
            params=parametros,
            headers={"X-API-KEY": api_key},
            timeout=30,
        )
        resposta.raise_for_status()
        corpo = resposta.json()
        resultados = corpo.get("results", [])
        todas.extend(resultados)

        proxima = corpo.get("next")
        if not proxima or not resultados:
            break
        parametros = {
            chave: valores[0] for chave, valores in parse_qs(urlparse(proxima).query).items()
        }

    return todas


def mapear_para_movimento(transacao: dict) -> dict:
    """Converte uma transação da Pluggy para o formato que
    `finance_api.repositorio.inserir_movimentos` espera (mesmo shape que
    `ingestion_worker.extrato.carregar_extrato` produz). `conta_id` vem
    direto do `accountId` da própria transação, sem mapeamento externo."""
    valor = float(transacao["amount"])
    e_transferencia_propria = transacao.get("category") == CATEGORIA_TRANSFERENCIA_PROPRIA

    if e_transferencia_propria:
        tipo = "aporte_titular" if valor > 0 else "retirada_titular"
    else:
        tipo = "receita" if valor > 0 else "despesa"

    data = datetime.fromisoformat(transacao["date"]).date()

    return {
        "conta_id": transacao["accountId"],
        "data": data.isoformat(),
        "valor": abs(valor),
        "descricao": transacao["description"],
        "tipo": tipo,
        "identificador_externo": transacao["id"],
    }


def mapear_conta(conta: dict) -> dict:
    """Converte uma conta da Pluggy para o formato da tabela `contas`.

    Conta corrente (`BANK`): só tem saldo. Cartão de crédito (`CREDIT`):
    `balance` já é o valor usado da fatura em aberto; `creditData` traz o
    limite total e o quanto ainda está disponível.
    """
    dados_credito = conta.get("creditData") or {}
    return {
        "id": conta["id"],
        "nome": conta.get("marketingName") or conta.get("name") or conta["id"],
        "tipo": conta["type"],
        "saldo": float(conta["balance"]),
        "limite": (
            float(dados_credito["creditLimit"]) if "creditLimit" in dados_credito else None
        ),
        "disponivel": (
            float(dados_credito["availableCreditLimit"])
            if "availableCreditLimit" in dados_credito
            else None
        ),
    }
