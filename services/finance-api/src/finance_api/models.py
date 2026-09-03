"""Modelo de persistência da tabela `movimentos`.

Separado de `finance_api.domain` de propósito: `domain.py` tem o `Movimento`
Pydantic (validação e regra), este módulo tem só o mapeamento para a tabela.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from finance_api.db import Base


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
    titularidade: Mapped[str] = mapped_column(String(2))
    data: Mapped[date] = mapped_column(Date)
    valor: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    descricao: Mapped[str] = mapped_column(String(500))
    tipo: Mapped[str] = mapped_column(String(30))
    proveniencia: Mapped[str] = mapped_column(String(30))
    identificador_externo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    fingerprint: Mapped[str] = mapped_column(String(16), index=True)
    duplicado_possivel: Mapped[bool] = mapped_column(Boolean, default=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
