"""categoria hospedagem

Revision ID: f1b6d3e8a204
Revises: e5a8c1d40f72
Create Date: 2026-10-29

Hospedagem sai de Viagem e vira categoria própria. Movimento escolhido pelo
dono, à mão ou no Mobills, fica como está; a reclassificação automática da
sincronização seguinte leva para cá a hospedagem que a Pluggy reconhece.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f1b6d3e8a204'
down_revision: str | Sequence[str] | None = 'e5a8c1d40f72'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    categorias = sa.table(
        'categorias',
        sa.column('id', sa.String),
        sa.column('nome', sa.String),
        sa.column('ordem', sa.Integer),
        sa.column('icone', sa.String),
        sa.column('cor', sa.Integer),
    )
    # Logo depois de Viagem na lista; as seguintes descem uma posição.
    op.execute("UPDATE categorias SET ordem = ordem + 1 WHERE ordem > 5")
    op.bulk_insert(categorias, [{"id": "hospedagem", "nome": "Hospedagem", "ordem": 6, "icone": "BedDouble", "cor": 245}])


def downgrade() -> None:
    op.execute(
        "UPDATE movimentos SET categoria_propria = 'viagem' WHERE categoria_propria = 'hospedagem'"
    )
    op.execute("DELETE FROM regras_de_categoria WHERE categoria_id = 'hospedagem'")
    op.execute("DELETE FROM categorias WHERE id = 'hospedagem'")
    op.execute("UPDATE categorias SET ordem = ordem - 1 WHERE ordem > 6")
