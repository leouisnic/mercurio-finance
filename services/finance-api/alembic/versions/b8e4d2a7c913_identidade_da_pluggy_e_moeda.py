"""Uma linha por transação da Pluggy, moeda de origem e movimentos removidos.

A Pluggy altera uma transação já entregue (data ou valor, ao sair de pendente)
mantendo o ID; como o fingerprint inclui data e valor, cada alteração virava
uma linha nova. Esta migração junta as cópias na linha mais antiga, que guarda
as decisões do dono, com os dados da mais nova, e cria o índice que impede a
repetição. Ver `docs/specs/2026-11-10-numeros-leva-2.md`.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b8e4d2a7c913"
down_revision = "d5f9c3e72b16"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("movimentos", sa.Column("moeda_original", sa.String(3), nullable=True))
    op.add_column("movimentos", sa.Column("valor_original", sa.Numeric(12, 2), nullable=True))

    op.create_table(
        "movimentos_removidos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("conta_id", sa.String(100), nullable=False, index=True),
        sa.Column("identificador_externo", sa.String(200), nullable=True, index=True),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("valor", sa.Numeric(12, 2), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        # A linha inteira e as tags, para restaurar se a Pluggy devolver o ID.
        sa.Column("dados", postgresql.JSONB(), nullable=False),
        sa.Column("removido_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Valores da cópia mais nova de cada ID repetido, guardados antes de apagar
    # as cópias: a chave única (fingerprint, identificador_externo) não aceita
    # a linha mantida com o fingerprint da cópia enquanto ela existir.
    op.execute(
        """
        create temporary table copias on commit drop as
        with repetidos as (
            select identificador_externo, min(id) as mantida, max(id) as mais_nova
            from movimentos
            where proveniencia = 'pluggy' and identificador_externo is not null
            group by identificador_externo
            having count(*) > 1
        )
        select r.mantida, r.identificador_externo, n.data, n.valor, n.descricao, n.tipo,
               n.fingerprint, n.categoria, n.categoria_id, n.duplicado_possivel
        from repetidos r join movimentos n on n.id = r.mais_nova
        """
    )
    op.execute(
        """
        insert into movimento_tags (movimento_id, tag_id)
        select c.mantida, t.tag_id
        from copias c
        join movimentos m on m.identificador_externo = c.identificador_externo
            and m.proveniencia = 'pluggy' and m.id <> c.mantida
        join movimento_tags t on t.movimento_id = m.id
        on conflict do nothing
        """
    )
    # Categoria própria e fatura decididas numa cópia passam para a mantida
    # quando ela não tem as suas.
    op.execute(
        """
        update movimentos mantida set
            categoria_propria = coalesce(mantida.categoria_propria, outra.categoria_propria),
            origem_da_categoria = case when mantida.categoria_propria is null
                then outra.origem_da_categoria else mantida.origem_da_categoria end,
            pagamento_de_fatura = coalesce(mantida.pagamento_de_fatura, outra.pagamento_de_fatura)
        from copias c, lateral (
            select m.categoria_propria, m.origem_da_categoria, m.pagamento_de_fatura
            from movimentos m
            where m.identificador_externo = c.identificador_externo
              and m.proveniencia = 'pluggy' and m.id <> c.mantida
            order by (m.categoria_propria is null), m.id desc
            limit 1
        ) outra
        where mantida.id = c.mantida
        """
    )
    op.execute(
        """
        delete from movimentos m using copias c
        where m.identificador_externo = c.identificador_externo
          and m.proveniencia = 'pluggy' and m.id <> c.mantida
        """
    )
    op.execute(
        """
        update movimentos m set data = c.data, valor = c.valor, descricao = c.descricao,
            tipo = c.tipo, fingerprint = c.fingerprint, categoria = c.categoria,
            categoria_id = c.categoria_id, duplicado_possivel = c.duplicado_possivel
        from copias c where m.id = c.mantida
        """
    )
    op.create_index(
        "uq_movimentos_pluggy_id",
        "movimentos",
        ["identificador_externo"],
        unique=True,
        postgresql_where=sa.text("proveniencia = 'pluggy'"),
    )


def downgrade() -> None:
    # As cópias juntadas no upgrade não voltam: eram a mesma transação.
    op.drop_index("uq_movimentos_pluggy_id", table_name="movimentos")
    op.drop_table("movimentos_removidos")
    op.drop_column("movimentos", "valor_original")
    op.drop_column("movimentos", "moeda_original")
