"""categorias proprias

Revision ID: c4e1a7d93b20
Revises: b92ad70491e9
Create Date: 2026-10-28

A categoria da Pluggy fica como veio, em `movimentos.categoria`. Ao lado
dela nasce a do Mercúrio, com a origem de quem decidiu, e as regras por
destinatário. Movimento antigo começa sem categoria própria: a sincronização
seguinte, ou a importação do Mobills, preenche.

As categorias ficam escritas aqui em vez de importadas de
`finance_api.categorias`: a migração descreve o banco desta versão e não
pode mudar quando o código mudar.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c4e1a7d93b20'
down_revision: str | Sequence[str] | None = 'b92ad70491e9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIAS = [
    ("alimentacao", "Alimentação"),
    ("supermercado", "Supermercado"),
    ("transporte", "Transporte"),
    ("saude", "Saúde"),
    ("farmacia", "Farmácia"),
    ("viagem", "Viagem"),
    ("casa", "Casa"),
    ("assinaturas", "Assinaturas"),
    ("educacao", "Educação"),
    ("compras", "Compras"),
    ("vestuario", "Vestuário"),
    ("lazer", "Lazer"),
    ("servicos", "Serviços"),
    ("presentes-e-doacoes", "Presentes e doações"),
    ("pix-para-pessoas", "Pix para pessoas"),
    ("investimento-e-reserva", "Investimento e reserva"),
    ("salario-e-extras", "Salário e extras"),
    ("taxas-e-tarifas", "Taxas e tarifas"),
    ("outros", "Outros"),
]


def upgrade() -> None:
    categorias = op.create_table(
        'categorias',
        sa.Column('id', sa.String(length=40), primary_key=True),
        sa.Column('nome', sa.String(length=60), nullable=False),
        sa.Column('ordem', sa.Integer(), nullable=False),
    )
    op.bulk_insert(
        categorias,
        [{"id": id_, "nome": nome, "ordem": ordem} for ordem, (id_, nome) in enumerate(CATEGORIAS)],
    )
    op.create_table(
        'regras_de_categoria',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('chave', sa.String(length=500), nullable=False, unique=True),
        sa.Column('categoria_id', sa.String(length=40), sa.ForeignKey('categorias.id'), nullable=True),
        sa.Column('origem', sa.String(length=20), nullable=False),
        sa.Column(
            'atualizado_em', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.add_column(
        'movimentos',
        sa.Column('categoria_propria', sa.String(length=40), sa.ForeignKey('categorias.id'), nullable=True),
    )
    op.add_column('movimentos', sa.Column('origem_da_categoria', sa.String(length=20), nullable=True))
    op.create_index('ix_movimentos_categoria_propria', 'movimentos', ['categoria_propria'])


def downgrade() -> None:
    op.drop_index('ix_movimentos_categoria_propria', table_name='movimentos')
    op.drop_column('movimentos', 'origem_da_categoria')
    op.drop_column('movimentos', 'categoria_propria')
    op.drop_table('regras_de_categoria')
    op.drop_table('categorias')
