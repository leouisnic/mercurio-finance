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
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
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
    item_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
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
    # Categoria do Mercúrio, ao lado da que a Pluggy mandou, que fica como veio.
    # Nula em receita ou despesa é "para classificar". A origem diz quem
    # decidiu, ver `finance_api.categorias.OrigemDaCategoria`.
    categoria_propria: Mapped[str | None] = mapped_column(
        ForeignKey("categorias.id"), nullable=True, index=True
    )
    origem_da_categoria: Mapped[str | None] = mapped_column(String(20), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CategoriaORM(Base):
    __tablename__ = "categorias"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    nome: Mapped[str] = mapped_column(String(60))
    ordem: Mapped[int] = mapped_column(Integer)
    # Nome do ícone no `lucide-react` e o tom da cor, de 0 a 359. O claro e o
    # escuro de cada tema saem de tokens do painel, medidos por
    # `scripts/contraste.py`, e não daqui.
    icone: Mapped[str] = mapped_column(String(40))
    cor: Mapped[int] = mapped_column(Integer)


class TagORM(Base):
    """Agrupa movimentos, como uma viagem ou uma reforma. Não muda número
    nenhum: só permite somar o que foi marcado com ela."""

    __tablename__ = "tags"
    __table_args__ = (Index("uq_tags_nome", func.lower(text("nome")), unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(60))
    # Como na categoria: nome do ícone no `lucide-react` e só o tom da cor.
    icone: Mapped[str] = mapped_column(String(40), server_default="Tag")
    cor: Mapped[int] = mapped_column(Integer, server_default="278")
    teto: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    # Período da tag, opcional; é o que o modo viagem vai usar para marcar sozinho.
    inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    arquivada: Mapped[bool] = mapped_column(Boolean, server_default="false")


class MovimentoTagORM(Base):
    __tablename__ = "movimento_tags"

    movimento_id: Mapped[int] = mapped_column(
        ForeignKey("movimentos.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True, index=True)


class RegraDeCategoriaORM(Base):
    """A categoria de tudo que vai para um destinatário, pela chave de
    `finance_api.categorias.chave_do_destinatario`. Categoria nula é
    destinatário misto: cada movimento novo dele fica para classificar."""

    __tablename__ = "regras_de_categoria"

    id: Mapped[int] = mapped_column(primary_key=True)
    chave: Mapped[str] = mapped_column(String(500), unique=True)
    categoria_id: Mapped[str | None] = mapped_column(ForeignKey("categorias.id"), nullable=True)
    # `mobills` (aprendida na importação) ou `dono` (correção na tela). A do
    # dono nunca é trocada por uma importação.
    origem: Mapped[str] = mapped_column(String(20))
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


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
    fim_previsto: Mapped[date | None] = mapped_column(Date, nullable=True)
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
