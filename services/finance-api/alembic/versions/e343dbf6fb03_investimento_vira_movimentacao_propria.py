"""investimento vira movimentacao propria

Revision ID: e343dbf6fb03
Revises: a1bbbe4eab1d
Create Date: 2026-10-22 02:22:20.681393

Aplicação e resgate (família "Investments" da Pluggy, menos rendimento)
eram gravados como despesa e receita. Passam a ser movimentação entre
contas do titular, como `ingestion_worker.pluggy.mapear_para_movimento`
já faz para o que chega.

O fingerprint é recalculado junto porque o tipo entra nele: sem isso a
próxima sincronização traria a mesma transação com fingerprint novo, e o
`ON CONFLICT` não a reconheceria, duplicando a linha. A marca de pagamento
de fatura sai porque só vale para despesa; o movimento continua fora do
gasto, que era o efeito dela.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from mercurio_domain import fingerprint

# revision identifiers, used by Alembic.
revision: str = 'e343dbf6fb03'
down_revision: str | Sequence[str] | None = 'a1bbbe4eab1d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Copiados de `ingestion_worker.pluggy` em vez de importados: a migração tem
# de continuar fazendo a mesma coisa se a regra do mapeamento mudar depois.
PREFIXO_INVESTIMENTO = "03"
CATEGORIA_RENDIMENTO = "03060000"


def _reclassificar(de_para: dict[str, str]) -> None:
    conexao = op.get_bind()
    linhas = conexao.execute(
        sa.text(
            "SELECT id, conta_id, data, valor, descricao, tipo FROM movimentos "
            "WHERE categoria_id LIKE :prefixo AND categoria_id <> :rendimento "
            "AND tipo = ANY(:tipos)"
        ),
        {
            "prefixo": f"{PREFIXO_INVESTIMENTO}%",
            "rendimento": CATEGORIA_RENDIMENTO,
            "tipos": list(de_para),
        },
    ).all()
    for linha in linhas:
        tipo_novo = de_para[linha.tipo]
        conexao.execute(
            sa.text(
                "UPDATE movimentos SET tipo = :tipo, fingerprint = :fingerprint, "
                "pagamento_de_fatura = NULL WHERE id = :id"
            ),
            {
                "id": linha.id,
                "tipo": tipo_novo,
                "fingerprint": fingerprint(
                    conta_id=linha.conta_id,
                    data=linha.data,
                    valor=linha.valor,
                    descricao=linha.descricao,
                    tipo=tipo_novo,
                ),
            },
        )


def upgrade() -> None:
    _reclassificar({"despesa": "retirada_titular", "receita": "aporte_titular"})


def downgrade() -> None:
    # A marca de fatura apagada no upgrade não volta: ela não ficou guardada.
    _reclassificar({"retirada_titular": "despesa", "aporte_titular": "receita"})
