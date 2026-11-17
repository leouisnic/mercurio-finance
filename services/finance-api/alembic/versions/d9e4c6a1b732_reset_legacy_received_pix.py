"""Devolve receitas antigas de categorias mistas para classificação."""

from alembic import op

revision = "d9e4c6a1b732"
down_revision = "c7a2e9b4d561"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE movimentos SET categoria_propria = NULL, origem_da_categoria = NULL
        WHERE tipo = 'receita' AND categoria_propria IN ('saude', 'pix-para-pessoas')
        """
    )


def downgrade() -> None:
    # As categorias eram mistas; reconstruir a escolha apagada exige o
    # backup anterior. Recuar a revisão mantém os movimentos para classificar.
    pass
