"""Importador de extrato bancário (CSV, e outras origens como a Pluggy).

Usa o fingerprint compartilhado de `mercurio_domain` (mesma regra da
finance-api). O identificador externo (coluna `identificador_externo`) já
foi observado reaproveitado em lançamentos diferentes em dados reais do
Leonardo, por isso não é chave única sozinho: uma duplicidade só é
considerada confirmada quando fingerprint E identificador externo batem
os dois. Fingerprint igual com identificador diferente é ambíguo (pode
ser duplicidade real ou dois eventos legítimos iguais) e fica marcado
para revisão humana, sem ser removido do resumo sozinho.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

import pandas as pd
from mercurio_domain import (
    SINAL_POR_TIPO,
    TIPOS_VALIDOS,
    TITULARIDADES_VALIDAS,
)
from mercurio_domain import (
    fingerprint as calcular_fingerprint,
)

COLUNAS_ESPERADAS = [
    "data",
    "valor",
    "descricao",
    "titularidade",
    "tipo",
    "identificador_externo",
]

SINAL_POR_TIPO_STR = {tipo.value: sinal for tipo, sinal in SINAL_POR_TIPO.items()}


def _parse_data(valor: object) -> date:
    try:
        # Data de extrato bancário não carrega fuso horário; date() descarta
        # o componente de hora que o strptime exige.
        return datetime.strptime(str(valor).strip(), "%Y-%m-%d").date()  # noqa: DTZ007
    except ValueError as erro:
        raise ValueError(
            f"Data inválida no extrato, esperado AAAA-MM-DD: {valor!r}"
        ) from erro


def _fingerprint_linha(linha: pd.Series) -> str:
    return calcular_fingerprint(
        titularidade=linha["titularidade"],
        data=linha["_data_parseada"],
        valor=linha["valor"],
        descricao=linha["descricao"],
        tipo=linha["tipo"],
    )


def processar_movimentos(movimentos: pd.DataFrame) -> pd.DataFrame:
    """Valida, calcula fingerprint e marca duplicidade de um DataFrame de
    movimentos, venha de onde vier (CSV, Pluggy, XML de NFS-e).

    Rejeita a importação (levanta `ValueError`) se alguma linha tiver
    titularidade ou tipo fora do esperado, valor ausente ou não positivo,
    ou data em formato diferente de AAAA-MM-DD. Antes desta checagem,
    esses casos eram descartados em silêncio pelo pandas em vez de barrar
    a importação.
    """
    extrato = movimentos.copy()

    colunas_faltando = set(COLUNAS_ESPERADAS) - set(extrato.columns)
    if colunas_faltando:
        raise ValueError(f"Colunas faltando no extrato: {sorted(colunas_faltando)}")

    extrato["titularidade"] = extrato["titularidade"].astype(str).str.strip().str.lower()
    extrato["tipo"] = extrato["tipo"].astype(str).str.strip().str.lower()

    titularidade_invalida = ~extrato["titularidade"].isin(TITULARIDADES_VALIDAS)
    tipo_invalido = ~extrato["tipo"].isin(TIPOS_VALIDOS)
    if titularidade_invalida.any() or tipo_invalido.any():
        linhas = sorted(
            (extrato.index[titularidade_invalida | tipo_invalido] + 2).tolist()
        )
        raise ValueError(
            f"Titularidade ou tipo inválido no extrato, linhas (1 = cabeçalho): {linhas}"
        )

    valor_numerico = pd.to_numeric(extrato["valor"], errors="coerce")
    valor_ausente = valor_numerico.isna()
    if valor_ausente.any():
        linhas = sorted((extrato.index[valor_ausente] + 2).tolist())
        raise ValueError(f"Valor ausente no extrato, linhas (1 = cabeçalho): {linhas}")

    extrato["valor"] = valor_numerico
    valor_nao_positivo = extrato["valor"] <= 0
    if valor_nao_positivo.any():
        linhas = sorted((extrato.index[valor_nao_positivo] + 2).tolist())
        raise ValueError(
            "Valor deve ser positivo, o sinal vem do tipo do movimento. "
            f"Linhas (1 = cabeçalho): {linhas}"
        )

    extrato["_data_parseada"] = extrato["data"].apply(_parse_data)
    extrato["fingerprint"] = extrato.apply(_fingerprint_linha, axis=1)
    extrato = extrato.drop(columns="_data_parseada")

    duplicado_confirmado = extrato.duplicated(
        subset=["fingerprint", "identificador_externo"], keep=False
    )
    duplicado_mesmo_fingerprint = extrato.duplicated(subset="fingerprint", keep=False)
    extrato["duplicado"] = duplicado_confirmado
    extrato["duplicado_possivel"] = duplicado_mesmo_fingerprint & ~duplicado_confirmado

    return extrato


def carregar_extrato(caminho: Path) -> pd.DataFrame:
    """Lê um CSV de extrato e devolve os lançamentos processados
    (fingerprint e duplicidade). Ver `processar_movimentos`."""
    return processar_movimentos(pd.read_csv(caminho, dtype=str))


def resumir_por_titularidade(extrato: pd.DataFrame) -> pd.DataFrame:
    """Soma o saldo dos lançamentos sem duplicidade confirmada, agrupados
    por titularidade.

    Receita e aporte do titular somam; despesa e retirada do titular
    subtraem. Retirada e aporte do titular não são despesa nem receita,
    mas ainda mudam o saldo de cada conta.

    Lançamentos marcados como `duplicado_possivel` (mesmo fingerprint,
    identificador externo diferente) continuam somados: sem mais contexto
    não dá para saber se são duplicidade real ou dois eventos legítimos
    iguais, então a decisão de remover fica para revisão humana.
    """
    sem_duplicidade_confirmada = extrato.drop_duplicates(
        subset=["fingerprint", "identificador_externo"]
    ).copy()

    sinal = sem_duplicidade_confirmada["tipo"].map(SINAL_POR_TIPO_STR)
    sem_duplicidade_confirmada["valor_com_sinal"] = (
        sem_duplicidade_confirmada["valor"] * sinal
    )

    return (
        sem_duplicidade_confirmada.groupby("titularidade")["valor_com_sinal"]
        .sum()
        .round(2)
        .reset_index()
        .rename(columns={"valor_com_sinal": "total"})
    )
