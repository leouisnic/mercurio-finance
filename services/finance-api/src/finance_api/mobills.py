"""Copia para o banco local a categoria que o dono deu no Mobills.

O Mobills não traz identificador de transação, então cada linha é casada com
um movimento que a Pluggy já trouxe: mesmo valor, mesmo sentido e até
`FOLGA_DIAS` de diferença na data, um para um. Dos casados saem também as
regras por destinatário.

Uso: uv run --package finance-api python -m finance_api.mobills <arquivo.csv>

O arquivo é a exportação do Mobills, lida de onde está e nunca copiada. A
saída tem só contagens.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import io
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from finance_api.categorias import OrigemDaCategoria, categoria_do_mobills, chave_do_destinatario
from finance_api.db import async_session
from finance_api.models import MovimentoORM, RegraDeCategoriaORM
from finance_api.repositorio import classificar_movimentos

# O Mobills anota o dia em que a pessoa lançou; o banco, o dia em que
# compensou. Um dia cobre o Pix da madrugada e a compra lançada no dia seguinte.
FOLGA_DIAS = 1
SAIDAS = ("despesa", "retirada_titular")
ENTRADAS = ("receita", "aporte_titular")


@dataclass(frozen=True)
class LinhaDoMobills:
    data: date
    valor: Decimal  # negativo é saída, como o Mobills exporta
    categoria: str  # nome como está no Mobills


@dataclass(frozen=True)
class MovimentoParaCasar:
    id: int
    data: date
    valor: Decimal
    tipo: str
    descricao: str


def _numero(texto: str) -> Decimal | None:
    texto = texto.replace("R$", "").replace(" ", "")
    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    try:
        return Decimal(texto)
    except InvalidOperation:
        return None


def ler_csv(caminho: Path) -> list[LinhaDoMobills]:
    """Lê a exportação do Mobills: separada por ponto e vírgula e, na versão
    atual, em UTF-16. Linha sem data ou valor legível é ignorada."""
    bruto = caminho.read_bytes()
    texto = bruto.decode("utf-16") if bruto[:2] in (b"\xff\xfe", b"\xfe\xff") else bruto.decode("utf-8-sig")
    linhas = []
    for registro in csv.DictReader(io.StringIO(texto), delimiter=";"):
        campos = {chave.strip(): (valor or "").strip() for chave, valor in registro.items() if chave}
        valor = _numero(campos.get("Valor", ""))
        try:
            dia = datetime.strptime(campos.get("Data", "")[:10], "%d/%m/%Y").date()  # noqa: DTZ007
        except ValueError:
            continue
        if valor is not None and valor != 0:
            linhas.append(LinhaDoMobills(dia, valor, campos.get("Categoria", "")))
    return linhas


def casar(
    linhas: list[LinhaDoMobills], movimentos: list[MovimentoParaCasar]
) -> list[tuple[LinhaDoMobills, MovimentoParaCasar]]:
    """Cada linha fica com o movimento livre mais próximo na data, de mesmo
    valor e mesmo sentido. Empate vai para o id menor, para rodar de novo dar
    o mesmo resultado."""
    por_valor: dict[Decimal, list[MovimentoParaCasar]] = defaultdict(list)
    for movimento in movimentos:
        por_valor[movimento.valor].append(movimento)
    usados: set[int] = set()
    pares = []
    for linha in linhas:
        sentido = SAIDAS if linha.valor < 0 else ENTRADAS
        candidatos = [
            movimento
            for movimento in por_valor.get(abs(linha.valor), [])
            if movimento.id not in usados
            and movimento.tipo in sentido
            and abs((movimento.data - linha.data).days) <= FOLGA_DIAS
        ]
        if candidatos:
            escolhido = min(candidatos, key=lambda m: (abs((m.data - linha.data).days), m.id))
            usados.add(escolhido.id)
            pares.append((linha, escolhido))
    return pares


async def importar(sessao: AsyncSession, linhas: list[LinhaDoMobills]) -> dict[str, int]:
    """Grava a categoria do Mobills nos movimentos casados e cria as regras.

    Correção feita na tela vence o Mobills: movimento e regra do dono não
    mudam. Rodar de novo com o mesmo arquivo não muda nada.
    """
    conhecidas = [linha for linha in linhas if categoria_do_mobills(linha.categoria)]
    gravados = (
        await sessao.execute(
            select(
                MovimentoORM.id,
                MovimentoORM.data,
                MovimentoORM.valor,
                MovimentoORM.tipo,
                MovimentoORM.descricao,
                MovimentoORM.origem_da_categoria,
            )
        )
    ).all()
    # O movimento corrigido pelo dono entra no casamento, para a linha dele
    # no Mobills não ir parar em outro de mesmo valor, mas não é regravado.
    do_dono = {linha.id for linha in gravados if linha.origem_da_categoria == OrigemDaCategoria.DONO.value}
    pares = casar(conhecidas, [MovimentoParaCasar(*linha[:5]) for linha in gravados])

    atualizacoes = [
        {
            "id": movimento.id,
            "categoria_propria": categoria_do_mobills(linha.categoria),
            "origem_da_categoria": OrigemDaCategoria.MOBILLS.value,
        }
        for linha, movimento in pares
        if movimento.id not in do_dono
    ]
    if atualizacoes:
        await sessao.execute(update(MovimentoORM), atualizacoes)

    por_destinatario: dict[str, Counter[str]] = defaultdict(Counter)
    for linha, movimento in pares:
        por_destinatario[chave_do_destinatario(movimento.descricao)][categoria_do_mobills(linha.categoria)] += 1
    regras = [
        {
            "chave": chave,
            "categoria_id": next(iter(contagem)) if len(contagem) == 1 else None,
            "origem": OrigemDaCategoria.MOBILLS.value,
        }
        for chave, contagem in por_destinatario.items()
    ]
    if regras:
        instrucao = pg_insert(RegraDeCategoriaORM).values(regras)
        await sessao.execute(
            instrucao.on_conflict_do_update(
                index_elements=["chave"],
                set_={"categoria_id": instrucao.excluded.categoria_id},
                where=RegraDeCategoriaORM.origem != OrigemDaCategoria.DONO.value,
            )
        )
    await sessao.commit()
    await classificar_movimentos(sessao)

    return {
        "linhas": len(linhas),
        "categoria_desconhecida": len(linhas) - len(conhecidas),
        "casadas": len(pares),
        "regras": sum(1 for regra in regras if regra["categoria_id"] is not None),
        "destinatarios_mistos": sum(1 for regra in regras if regra["categoria_id"] is None),
    }


async def _principal(caminho: Path) -> None:
    async with async_session() as sessao:
        contagens = await importar(sessao, ler_csv(caminho))
    for nome, quantidade in contagens.items():
        print(f"{nome}: {quantidade}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("arquivo", type=Path)
    asyncio.run(_principal(parser.parse_args().arquivo))
