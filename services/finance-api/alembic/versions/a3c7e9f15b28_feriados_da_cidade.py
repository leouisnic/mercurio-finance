"""feriados da cidade

Revision ID: a3c7e9f15b28
Revises: f1b6d3e8a204
Create Date: 2026-11-04

Feriado cadastrado pelo dono, com de quem ele muda o dia de pagamento.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a3c7e9f15b28'
down_revision: str | Sequence[str] | None = 'f1b6d3e8a204'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'feriados',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('nome', sa.String(60), nullable=False),
        sa.Column('data', sa.Date(), nullable=False),
        sa.Column('repete_todo_ano', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('muda_ciclo_1', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('muda_ciclo_2', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('feriados')
