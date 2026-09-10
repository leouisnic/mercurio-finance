"""Modelo de persistência: tabelas `contas`, `movimentos`, `recorrencias`
e `compromissos`.

Separado de `finance_api.domain` de propósito: `domain.py` tem os modelos
Pydantic (validação e regra), este módulo tem só o mapeamento para as
tabelas.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from finance_api.db import Base


class ContaORM(Base):
    """Uma conta bancária conectada no Pluggy (corrente ou cartão de
    crédito). Nome, saldo e (para cartão) limite vêm sempre da Pluggy,
    atualizados a cada `job_sincronizar_pluggy`; nada fixo no código."""

    __tablename__ = "contas"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    nome: Mapped[str] = mapped_column(String(200))
    # Nome escolhido pelo Leonardo. A Pluggy nem sempre diz o banco: o cartão do
    # Nubank chega como "gold". Nunca entra no `set_` do upsert, senão a
    # sincronização seguinte apaga a escolha dele.
    apelido: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tipo: Mapped[str] = mapped_column(String(20))  # "BANK" ou "CREDIT"
    saldo: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    limite: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    disponivel: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    bandeira: Mapped[str | None] = mapped_column(String(30), nullable=True)
    final: Mapped[str | None] = mapped_column(String(4), nullable=True)
    # Datas da fatura em aberto, como a Pluggy informa em
    # `creditData.balanceCloseDate`/`balanceDueDate`. Nulas para conta corrente.
    fechamento: Mapped[date | None] = mapped_column(Date, nullable=True)
    vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class MovimentoORM(Base):
    __tablename__ = "movimentos"
    __table_args__ = (
        # Reimportar a mesma linha de origem não duplica: é a mesma regra de
        # "duplicidade confirmada" de mercurio_domain, aplicada no banco.
        UniqueConstraint(
            "fingerprint", "identificador_externo", name="uq_movimentos_fingerprint_id"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conta_id: Mapped[str] = mapped_column(ForeignKey("contas.id"), index=True)
    data: Mapped[date] = mapped_column(Date, index=True)
    valor: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    descricao: Mapped[str] = mapped_column(String(500))
    tipo: Mapped[str] = mapped_column(String(30))
    proveniencia: Mapped[str] = mapped_column(String(30))
    identificador_externo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    fingerprint: Mapped[str] = mapped_column(String(16), index=True)
    duplicado_possivel: Mapped[bool] = mapped_column(Boolean, default=False)
    # Categoria como a Pluggy classificou (nome e id da árvore dela). Nulo
    # para origem que não categoriza (CSV, XML de NFS-e).
    categoria: Mapped[str | None] = mapped_column(String(100), nullable=True)
    categoria_id: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    # Conclusão do Mercúrio (não do banco) de que este movimento é o
    # pagamento de fatura: `detectado` (automático), `confirmado` ou
    # `descartado` (os dois por revisão humana). Nulo = movimento
    # comum. Fica separado de `tipo` de propósito: `tipo` entra no
    # fingerprint e representa o que a origem informou, imutável; isto é
    # interpretação, e por isso pode ser desfeita.
    pagamento_de_fatura: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RecorrenciaORM(Base):
    """Um padrão de despesa repetida que a detecção encontrou no histórico.

    Nasce sempre como `pendente`: nada vira recorrência sem aprovação
    humana, pois uma cobrança repetida pode ser um
    parcelamento com prazo para acabar). Ver `finance_api.recorrencias`
    para a regra de detecção.
    """

    __tablename__ = "recorrencias"
    __table_args__ = (
        # A detecção reencontra o mesmo padrão a cada sincronização; a chave
        # (conta, descrição) é o que permite atualizar em vez de duplicar.
        UniqueConstraint("conta_id", "descricao", name="uq_recorrencias_conta_descricao"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conta_id: Mapped[str] = mapped_column(ForeignKey("contas.id"), index=True)
    descricao: Mapped[str] = mapped_column(String(500))
    # Preenchidos na revisão: a descrição bancária nem sempre informa a
    # finalidade do movimento.
    apelido: Mapped[str | None] = mapped_column(String(100), nullable=True)
    categoria: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    valor_medio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    ocorrencias: Mapped[int] = mapped_column(Integer)
    primeira_data: Mapped[date] = mapped_column(Date)
    ultima_data: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="pendente", index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CompromissoORM(Base):
    """Uma obrigação futura cadastrada à mão (não detectada): valor por
    parcela, início e fim definidos.

    `data_fim` é obrigatória: é o que separa compromisso de assinatura.
    Camada de planejamento, não conciliada automaticamente contra os
    movimentos reais. Ver docs/decisions.md.
    """

    __tablename__ = "compromissos"

    id: Mapped[int] = mapped_column(primary_key=True)
    descricao: Mapped[str] = mapped_column(String(500))
    valor_parcela: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    data_inicio: Mapped[date] = mapped_column(Date)
    data_fim: Mapped[date] = mapped_column(Date)
    periodicidade: Mapped[str] = mapped_column(String(20), default="mensal")
    conta_id: Mapped[str | None] = mapped_column(
        ForeignKey("contas.id"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="ativo", index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
