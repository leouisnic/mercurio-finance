"""tags com teto e periodo

Revision ID: e5a8c1d40f72
Revises: d7f3b2a91c45
Create Date: 2026-10-28

A tag passa a ter ícone e cor, como a categoria (a cor guarda só o tom), um
teto opcional em `numeric`, um período opcional e o estado de arquivada. Tag
que já existe recebe o ícone de etiqueta e o índigo da marca.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e5a8c1d40f72'
down_revision: str | Sequence[str] | None = 'd7f3b2a91c45'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('tags', sa.Column('icone', sa.String(length=40), nullable=False, server_default='Tag'))
    op.add_column('tags', sa.Column('cor', sa.Integer(), nullable=False, server_default='278'))
    op.add_column('tags', sa.Column('teto', sa.Numeric(12, 2), nullable=True))
    op.add_column('tags', sa.Column('inicio', sa.Date(), nullable=True))
    op.add_column('tags', sa.Column('fim', sa.Date(), nullable=True))
    op.add_column('tags', sa.Column('arquivada', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    for coluna in ('arquivada', 'fim', 'inicio', 'teto', 'cor', 'icone'):
        op.drop_column('tags', coluna)
