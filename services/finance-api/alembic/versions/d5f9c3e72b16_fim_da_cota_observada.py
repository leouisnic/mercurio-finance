"""Associa a observação de cota ao intervalo completo do ciclo."""

import sqlalchemy as sa
from alembic import op

revision = "d5f9c3e72b16"
down_revision = "c4e8b2d61a90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # O fim das observações antigas é desconhecido e precisa continuar assim.
    op.add_column("cotas_dos_ciclos", sa.Column("fim", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("cotas_dos_ciclos", "fim")
