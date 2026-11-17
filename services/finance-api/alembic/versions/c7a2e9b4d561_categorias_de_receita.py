"""Categorias de entrada e o tipo de cada categoria.

Até aqui havia uma lista só, e receita ficava em categoria de despesa. A
categoria passa a ter tipo; receita em categoria de despesa é reembolso, que
só o dono cria. O histórico se ajusta: rendimento vai para Rendimentos, receita
em Outros vai para Outras entradas, e as demais receitas em categoria de
despesa que não foram escolha do dono no painel voltam para classificar. Ver
`docs/specs/2026-11-13-categorias-de-receita-e-reembolso.md`.
"""

import sqlalchemy as sa
from alembic import op

revision = "c7a2e9b4d561"
down_revision = "b8e4d2a7c913"
branch_labels = None
depends_on = None

ENTRADAS = [
    ("rendimentos", "Rendimentos", "TrendingUp", 150),
    ("vendas", "Vendas", "Store", 60),
    ("presentes-recebidos", "Presentes recebidos", "Gift", 330),
    ("outras-entradas", "Outras entradas", "CirclePlus", 278),
]


def upgrade() -> None:
    op.add_column("categorias", sa.Column("tipo", sa.String(10), nullable=False, server_default="despesa"))
    op.execute("UPDATE categorias SET tipo = 'receita' WHERE id = 'salario-e-extras'")
    # No fim da lista, depois das categorias que o dono já tenha criado.
    valores = ", ".join(
        f"('{id_}', '{nome}', {numero}, '{icone}', {cor})" for numero, (id_, nome, icone, cor) in enumerate(ENTRADAS, 1)
    )
    op.execute(
        f"""
        INSERT INTO categorias (id, nome, ordem, icone, cor, tipo)
        SELECT v.id, v.nome, (SELECT coalesce(max(ordem), -1) FROM categorias) + v.n, v.icone, v.cor, 'receita'
        FROM (VALUES {valores}) AS v(id, nome, n, icone, cor)
        """
    )
    op.execute(
        "UPDATE movimentos SET categoria_propria = 'rendimentos' "
        "WHERE tipo = 'receita' AND categoria_propria = 'investimento-e-reserva'"
    )
    op.execute(
        "UPDATE movimentos SET categoria_propria = 'outras-entradas' WHERE tipo = 'receita' AND categoria_propria = 'outros'"
    )
    op.execute(
        """
        UPDATE movimentos SET categoria_propria = NULL, origem_da_categoria = NULL
        WHERE tipo = 'receita' AND origem_da_categoria IS DISTINCT FROM 'dono'
          AND categoria_propria IN (SELECT id FROM categorias WHERE tipo = 'despesa')
        """
    )


def downgrade() -> None:
    # As receitas devolvidas para classificar não voltam: não há como saber a
    # categoria antiga de cada uma.
    op.execute(
        "UPDATE movimentos SET categoria_propria = 'investimento-e-reserva' "
        "WHERE tipo = 'receita' AND categoria_propria = 'rendimentos'"
    )
    op.execute(
        "UPDATE movimentos SET categoria_propria = 'outros' WHERE tipo = 'receita' AND categoria_propria = 'outras-entradas'"
    )
    ids = ", ".join(f"'{id_}'" for id_, *_ in ENTRADAS)
    op.execute(f"UPDATE movimentos SET categoria_propria = NULL, origem_da_categoria = NULL WHERE categoria_propria IN ({ids})")
    op.execute(f"DELETE FROM regras_de_categoria WHERE categoria_id IN ({ids})")
    op.execute(f"DELETE FROM categorias WHERE id IN ({ids})")
    op.drop_column("categorias", "tipo")
