"""Tipos e regra de fingerprint compartilhados entre finance-api e
ingestion-worker.

Existe como pacote separado porque os dois serviços já tiveram, em algum
momento, duas implementações independentes da mesma regra de fingerprint,
com normalização de valor e data diferentes: o mesmo movimento vindo de
fontes diferentes (extrato bancário vs. XML de NFS-e) podia gerar
fingerprints diferentes, e uma duplicidade real não era detectada. A
regra fica aqui uma vez só; cada serviço monta seus próprios dados de
entrada (parse de CSV, JSON etc.) e chama `fingerprint()`.
"""

from __future__ import annotations

import hashlib
from datetime import date
from decimal import Decimal, InvalidOperation
from enum import Enum


class Titularidade(str, Enum):
    """PF é a pessoa física. PJ é a empresa: no caso do Leonardo, um único
    CNPJ registrado como MEI, então PJ e MEI são a mesma conta e o mesmo
    saldo, não duas titularidades separadas. MEI aqui é o regime
    tributário da PJ (usado para calcular o DAS pela tabela certa), não
    um terceiro lugar onde o dinheiro fica."""

    PF = "pf"
    PJ = "pj"


class Proveniencia(str, Enum):
    EXTRATO_BANCARIO = "extrato_bancario"
    NFSE_XML = "nfse_xml"
    IMPORTACAO_MANUAL = "importacao_manual"
    PLUGGY = "pluggy"


class TipoMovimento(str, Enum):
    RECEITA = "receita"
    DESPESA = "despesa"
    RETIRADA_TITULAR = "retirada_titular"
    """Saída de uma titularidade para outra do mesmo dono. Não é despesa."""
    APORTE_TITULAR = "aporte_titular"
    """Entrada em uma titularidade vinda de outra do mesmo dono. Espelha
    RETIRADA_TITULAR do lado de origem. Não é receita."""


# Sinal aplicado ao valor (sempre positivo) para compor saldo. Receita e
# aporte do titular somam; despesa e retirada do titular subtraem.
SINAL_POR_TIPO: dict[TipoMovimento, int] = {
    TipoMovimento.RECEITA: 1,
    TipoMovimento.DESPESA: -1,
    TipoMovimento.RETIRADA_TITULAR: -1,
    TipoMovimento.APORTE_TITULAR: 1,
}

TITULARIDADES_VALIDAS = frozenset(item.value for item in Titularidade)
TIPOS_VALIDOS = frozenset(item.value for item in TipoMovimento)


def normalizar_valor(valor: Decimal | float | str) -> Decimal:
    """Converte para Decimal com 2 casas, a representação usada no
    fingerprint e no saldo. Rejeita valor não positivo: o sinal do
    movimento vem sempre do `tipo`, nunca do valor."""
    try:
        normalizado = Decimal(str(valor)).quantize(Decimal("0.01"))
    except InvalidOperation as erro:
        raise ValueError(f"Valor inválido: {valor!r}") from erro

    if normalizado <= 0:
        raise ValueError(
            f"Valor deve ser positivo, o sinal vem do tipo do movimento: {valor!r}"
        )
    return normalizado


def fingerprint(
    titularidade: Titularidade | str,
    data: date,
    valor: Decimal | float | str,
    descricao: str,
    tipo: TipoMovimento | str,
) -> str:
    """Chave de conciliação composta a partir do conteúdo do movimento.

    Dois movimentos com o mesmo fingerprint têm titularidade, data, valor,
    descrição e tipo iguais: são o mesmo evento financeiro, independente
    do identificador dado pelo banco ou pela fonte, que já foi observado
    reaproveitado em lançamentos diferentes nos dados reais do Leonardo.
    """
    valor_normalizado = normalizar_valor(valor)
    base = "|".join(
        [
            Titularidade(titularidade).value,
            data.isoformat(),
            f"{valor_normalizado:.2f}",
            descricao.strip().lower(),
            TipoMovimento(tipo).value,
        ]
    )
    return hashlib.sha256(base.encode("utf-8")).hexdigest()[:16]
