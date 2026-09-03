"""Leitura e escrita de contas e movimentos no Postgres.

Movimentos: recebe DataFrames já no formato que
`ingestion_worker.extrato.carregar_extrato` produz (fingerprint,
duplicado, duplicado_possivel já calculados), para não duplicar a regra
de conciliação aqui.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from finance_api.models import ContaORM, MovimentoORM


def _como_data(valor: object) -> object:
    if isinstance(valor, str):
        # Data de extrato bancário não carrega fuso horário.
        return datetime.strptime(valor, "%Y-%m-%d").date()  # noqa: DTZ007
    return valor


def _decimal_ou_none(valor: object) -> Decimal | None:
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return None
    return Decimal(str(valor)).quantize(Decimal("0.01"))


async def upsert_contas(sessao: AsyncSession, contas: list[dict]) -> None:
    """Grava ou atualiza contas (id, nome, tipo, saldo, limite,
    disponivel), no formato que `ingestion_worker.pluggy.mapear_conta`
    produz. Roda a cada sincronização: saldo e limite ficam sempre com o
    valor mais recente que a Pluggy devolveu."""
    if not contas:
        return

    valores = [
        {
            "id": conta["id"],
            "nome": conta["nome"],
            "tipo": conta["tipo"],
            "saldo": _decimal_ou_none(conta["saldo"]),
            "limite": _decimal_ou_none(conta.get("limite")),
            "disponivel": _decimal_ou_none(conta.get("disponivel")),
        }
        for conta in contas
    ]

    instrucao = pg_insert(ContaORM).values(valores)
    instrucao = instrucao.on_conflict_do_update(
        index_elements=["id"],
        set_={
            "nome": instrucao.excluded.nome,
            "tipo": instrucao.excluded.tipo,
            "saldo": instrucao.excluded.saldo,
            "limite": instrucao.excluded.limite,
            "disponivel": instrucao.excluded.disponivel,
        },
    )
    await sessao.execute(instrucao)
    await sessao.commit()


async def listar_contas(sessao: AsyncSession) -> list[ContaORM]:
    resultado = await sessao.execute(select(ContaORM).order_by(ContaORM.nome, ContaORM.tipo))
    return list(resultado.scalars().all())


async def inserir_movimentos(
    sessao: AsyncSession, extrato: pd.DataFrame, proveniencia: str
) -> int:
    """Insere os movimentos de um extrato já processado.

    Ignora duplicidade confirmada (mesma linha de origem reimportada) via
    `ON CONFLICT DO NOTHING` na constraint única do banco
    (`fingerprint`, `identificador_externo`), então rodar a mesma
    importação mais de uma vez é seguro e não duplica saldo. A conta
    referenciada (`conta_id`) precisa já existir em `contas` (upsert
    antes, ver `upsert_contas`), por causa da chave estrangeira.
    """
    if extrato.empty:
        return 0

    valores = [
        {
            "conta_id": linha["conta_id"],
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
    `resumir_por_conta` espera. Não há duplicidade confirmada para
    remover aqui: a constraint única do banco já garante isso na escrita.
    """
    resultado = await sessao.execute(select(MovimentoORM))
    movimentos = resultado.scalars().all()

    return pd.DataFrame(
        [
            {
                "conta_id": movimento.conta_id,
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
