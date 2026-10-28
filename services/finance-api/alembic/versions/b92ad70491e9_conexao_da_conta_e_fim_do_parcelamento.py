"""conexao da conta e fim do parcelamento

Revision ID: b92ad70491e9
Revises: e343dbf6fb03
Create Date: 2026-10-27

`contas.item_id` guarda a conexão bancária de origem: o cartão que a Pluggy
manda sem o nome do banco herda o banco da conta corrente da mesma conexão.
Fica nulo até a próxima sincronização.

`recorrencias.fim_previsto` é a data da última parcela de um parcelamento.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b92ad70491e9'
down_revision: str | Sequence[str] | None = 'e343dbf6fb03'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('contas', sa.Column('item_id', sa.String(length=100), nullable=True))
    op.add_column('recorrencias', sa.Column('fim_previsto', sa.Date(), nullable=True))


def downgrade() -> None:
    # Parcelamento e encerrada não existem antes desta versão: voltam a
    # pendente, e a decisão é refeita na tela.
    op.execute(
        "UPDATE recorrencias SET status = 'pendente' WHERE status IN ('parcelamento', 'encerrada')"
    )
    op.drop_column('recorrencias', 'fim_previsto')
    op.drop_column('contas', 'item_id')
