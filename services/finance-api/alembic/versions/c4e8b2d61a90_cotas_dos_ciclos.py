"""cotas dos ciclos

Revision ID: c4e8b2d61a90
Revises: a3c7e9f15b28
Create Date: 2026-11-05

A cota do dia de cada ciclo, guardada enquanto ele é o ciclo de hoje.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c4e8b2d61a90'
down_revision: str | Sequence[str] | None = 'a3c7e9f15b28'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'cotas_dos_ciclos',
        sa.Column('inicio', sa.Date(), primary_key=True),
        sa.Column('cota', sa.Numeric(12, 2), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('cotas_dos_ciclos')
