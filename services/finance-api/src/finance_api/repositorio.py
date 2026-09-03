"""Leitura e escrita de movimentos no Postgres.

Recebe DataFrames já no formato que `ingestion_worker.extrato.carregar_extrato`
produz (fingerprint, duplicado, duplicado_possivel já calculados), para não
duplicar a regra de conciliação aqui.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from finance_api.models import MovimentoORM


def _como_data(valor: object) -> object:
    if isinstance(valor, str):
        # Data de extrato bancário não carrega fuso horário.
        return datetime.strptime(valor, "%Y-%m-%d").date()  # noqa: DTZ007
    return valor


async def inserir_movimentos(
    sessao: AsyncSession, extrato: pd.DataFrame, proveniencia: str
) -> int:
    """Insere os movimentos de um extrato já processado.

    Ignora duplicidade confirmada (mesma linha de origem reimportada) via
    `ON CONFLICT DO NOTHING` na constraint única do banco
    (`fingerprint`, `identificador_externo`), então rodar a mesma
    importação mais de uma vez é seguro e não duplica saldo.
    """
    if extrato.empty:
        return 0

    valores = [
        {
            "titularidade": linha["titularidade"],
            "data": _como_data(linha["data"]),
            "valor": Decimal(str(linha["valor"])).quantize(Decimal("0.01")),
            "descricao": linha["descricao"],
            "tipo": linha["tipo"],
            "proveniencia": proveniencia,
            "identificador_externo": linha.get("identificador_externo") or None,
            "fingerprint": linha["fingerprint"],
            "duplicado_possivel": bool(linha.get("duplicado_possivel", False)),
        }
        for linha in extrato.to_dict("records")
    ]

    instrucao = pg_insert(MovimentoORM).values(valores)
    instrucao = instrucao.on_conflict_do_nothing(
        constraint="uq_movimentos_fingerprint_id"
    )
    resultado = await sessao.execute(instrucao)
    await sessao.commit()
    return resultado.rowcount or 0


async def carregar_movimentos(sessao: AsyncSession) -> pd.DataFrame:
    """Devolve os movimentos gravados no mesmo formato que
    `resumir_por_titularidade` espera. Não há duplicidade confirmada para
    remover aqui: a constraint única do banco já garante isso na escrita.
    """
    resultado = await sessao.execute(select(MovimentoORM))
    movimentos = resultado.scalars().all()

    return pd.DataFrame(
        [
            {
                "titularidade": movimento.titularidade,
                "valor": float(movimento.valor),
                "tipo": movimento.tipo,
                "fingerprint": movimento.fingerprint,
                "identificador_externo": movimento.identificador_externo,
                "duplicado": False,
                "duplicado_possivel": movimento.duplicado_possivel,
            }
            for movimento in movimentos
        ]
    )
