"""icones, cores e tags

Revision ID: d7f3b2a91c45
Revises: c4e1a7d93b20
Create Date: 2026-10-28

Cada categoria ganha um ícone (nome do `lucide-react`) e uma cor, guardada
só como o tom (0 a 359): o claro e o escuro de cada tema saem de tokens do
painel, para o contraste continuar medido. O dono passa a poder criar
categoria.

As tags agrupam movimentos (uma viagem, uma reforma) sem mudar número nenhum.
O nome é único sem distinção de caixa.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd7f3b2a91c45'
down_revision: str | Sequence[str] | None = 'c4e1a7d93b20'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

APARENCIA = {
    "alimentacao": ("Utensils", 45),
    "supermercado": ("ShoppingCart", 140),
    "transporte": ("Car", 250),
    "saude": ("HeartPulse", 15),
    "farmacia": ("Pill", 340),
    "viagem": ("Plane", 220),
    "casa": ("House", 70),
    "assinaturas": ("Repeat", 290),
    "educacao": ("GraduationCap", 265),
    "compras": ("ShoppingBag", 320),
    "vestuario": ("Shirt", 0),
    "lazer": ("PartyPopper", 305),
    "servicos": ("Wrench", 200),
    "presentes-e-doacoes": ("Gift", 350),
    "pix-para-pessoas": ("Users", 180),
    "investimento-e-reserva": ("PiggyBank", 160),
    "salario-e-extras": ("Wallet", 150),
    "taxas-e-tarifas": ("Receipt", 30),
    "outros": ("Ellipsis", 278),
}


def upgrade() -> None:
    op.add_column('categorias', sa.Column('icone', sa.String(length=40), nullable=True))
    op.add_column('categorias', sa.Column('cor', sa.Integer(), nullable=True))
    categorias = sa.table(
        'categorias', sa.column('id', sa.String), sa.column('icone', sa.String), sa.column('cor', sa.Integer)
    )
    for id_, (icone, cor) in APARENCIA.items():
        op.execute(
            categorias.update()
            .where(categorias.c.id == op.inline_literal(id_))
            .values(icone=op.inline_literal(icone), cor=op.inline_literal(cor))
        )
    op.alter_column('categorias', 'icone', nullable=False)
    op.alter_column('categorias', 'cor', nullable=False)

    op.create_table(
        'tags',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('nome', sa.String(length=60), nullable=False),
    )
    op.create_index('uq_tags_nome', 'tags', [sa.text('lower(nome)')], unique=True)
    op.create_table(
        'movimento_tags',
        sa.Column(
            'movimento_id', sa.Integer(), sa.ForeignKey('movimentos.id', ondelete='CASCADE'), primary_key=True
        ),
        sa.Column('tag_id', sa.Integer(), sa.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
    )
    op.create_index('ix_movimento_tags_tag_id', 'movimento_tags', ['tag_id'])


def downgrade() -> None:
    op.drop_index('ix_movimento_tags_tag_id', table_name='movimento_tags')
    op.drop_table('movimento_tags')
    op.drop_index('uq_tags_nome', table_name='tags')
    op.drop_table('tags')
    # Categoria criada pelo dono some junto: antes desta versão só existiam as 19.
    op.execute(
        "UPDATE movimentos SET categoria_propria = NULL, origem_da_categoria = NULL "
        "WHERE categoria_propria NOT IN ('" + "', '".join(APARENCIA) + "')"
    )
    op.execute("DELETE FROM regras_de_categoria WHERE categoria_id NOT IN ('" + "', '".join(APARENCIA) + "')")
    op.execute("DELETE FROM categorias WHERE id NOT IN ('" + "', '".join(APARENCIA) + "')")
    op.drop_column('categorias', 'cor')
    op.drop_column('categorias', 'icone')
