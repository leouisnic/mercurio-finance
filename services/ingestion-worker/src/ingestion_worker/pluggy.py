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
# despesa/receita, em vez de tentar adivinhar pela descrição. O id é mais
# estável que o nome, que fica de reserva.
CATEGORIA_TRANSFERENCIA_PROPRIA = "Same person transfer"
CATEGORIA_ID_TRANSFERENCIA_PROPRIA = "04000000"
# "Credit card payment": o pagamento da fatura visto pelo lado do cartão.
# Do lado da conta corrente o mesmo evento vem só como "Transfers"
# (05000000), genérico demais para servir de regra. Ver
# `finance_api.repositorio.marcar_pagamentos_de_fatura`.
CATEGORIA_ID_PAGAMENTO_DE_FATURA = "05100000"


class RespostaPluggyInvalida(ValueError):
    """A Pluggy devolveu dados insuficientes para classificação segura."""


class PaginacaoPluggyIncompleta(RuntimeError):
    """A paginação não terminou com segurança."""


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
    cursores_vistos: set[str] = set()

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
            return todas
        if proxima in cursores_vistos:
            raise PaginacaoPluggyIncompleta("a Pluggy repetiu o cursor de paginação")
        cursores_vistos.add(proxima)
        parametros = {
            chave: valores[0] for chave, valores in parse_qs(urlparse(proxima).query).items()
        }

    raise PaginacaoPluggyIncompleta(
        f"a paginação excedeu o limite de {limite_paginas} páginas"
    )


def _saiu_dinheiro(transacao: dict) -> bool:
    """Se o movimento tirou dinheiro da conta, segundo o `type` da Pluggy.

    O sinal do `amount` não serve: no cartão de crédito a Pluggy inverte a
    convenção da conta corrente (compra vem positiva, pagamento da fatura
    vem negativo). `type` (`DEBIT`/`CREDIT`) é consistente nos dois tipos
    de conta. Sem esse campo, o movimento não pode ser classificado com
    segurança.
    """
    tipo_pluggy = transacao.get("type")
    if tipo_pluggy == "DEBIT":
        return True
    if tipo_pluggy == "CREDIT":
        return False
    raise RespostaPluggyInvalida("transação sem type DEBIT ou CREDIT")


def mapear_para_movimento(transacao: dict) -> dict:
    """Converte uma transação da Pluggy para o formato que
    `finance_api.repositorio.inserir_movimentos` espera (mesmo shape que
    `ingestion_worker.extrato.carregar_extrato` produz). `conta_id` vem
    direto do `accountId` da própria transação, sem mapeamento externo."""
    valor = float(transacao["amount"])
    categoria = transacao.get("category")
    categoria_id = transacao.get("categoryId")
    saiu_dinheiro = _saiu_dinheiro(transacao)

    e_transferencia_propria = (
        categoria_id == CATEGORIA_ID_TRANSFERENCIA_PROPRIA
        or categoria == CATEGORIA_TRANSFERENCIA_PROPRIA
    )

    if categoria_id == CATEGORIA_ID_PAGAMENTO_DE_FATURA:
        # Pagamento da fatura visto pelo cartão: entra dinheiro e abate a
        # dívida. Não é receita, é a perna de destino de uma transferência
        # entre contas do mesmo titular.
        tipo = "aporte_titular"
    elif e_transferencia_propria:
        tipo = "retirada_titular" if saiu_dinheiro else "aporte_titular"
    else:
        tipo = "despesa" if saiu_dinheiro else "receita"

    data = datetime.fromisoformat(transacao["date"]).date()

    return {
        "conta_id": transacao["accountId"],
        "data": data.isoformat(),
        "valor": abs(valor),
        "descricao": transacao["description"],
        "tipo": tipo,
        "identificador_externo": transacao["id"],
        "categoria": categoria,
        "categoria_id": categoria_id,
    }


def mapear_conta(conta: dict) -> dict:
    """Converte uma conta da Pluggy para o formato da tabela `contas`.

    Conta corrente (`BANK`): só tem saldo. Cartão de crédito (`CREDIT`):
    `balance` já é o valor usado da fatura em aberto; `creditData` traz o
    limite total, o quanto ainda está disponível, a bandeira (`brand`) e as
    datas de fechamento e vencimento da fatura em aberto
    (`balanceCloseDate`/`balanceDueDate`, data ISO). O campo `number` da
    própria conta é o final do cartão nesse caso (é o número completo
    quando é conta corrente, por isso só é aproveitado para `CREDIT`).
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
        "bandeira": dados_credito.get("brand") if conta["type"] == "CREDIT" else None,
        "final": conta.get("number") if conta["type"] == "CREDIT" else None,
        "fechamento": dados_credito.get("balanceCloseDate"),
        "vencimento": dados_credito.get("balanceDueDate"),
    }
