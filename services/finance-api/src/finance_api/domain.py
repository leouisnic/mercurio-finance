"""Modelo de domínio do Mercúrio: contas e movimentos.

Tipo de movimento e o cálculo de fingerprint vêm do pacote compartilhado
`mercurio_domain`, para que finance-api e ingestion-worker nunca divirjam
na regra de conciliação. Ver `mercurio_domain` para o porquê.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from mercurio_domain import Proveniencia, TipoMovimento, normalizar_valor
from mercurio_domain import (
    fingerprint as calcular_fingerprint,
)
from pydantic import BaseModel, Field, field_validator

__all__ = [
    "Conta",
    "Movimento",
    "Proveniencia",
    "ResumoFinanceiro",
    "TipoMovimento",
    "encontrar_duplicidades",
]


class Movimento(BaseModel):
    """Um lançamento financeiro já ligado a uma conta."""

    conta_id: str
    data: date
    valor: Decimal
    descricao: str
    tipo: TipoMovimento
    proveniencia: Proveniencia
    identificador_externo: str | None = Field(
        default=None,
        description=(
            "Identificador dado pelo banco ou pela fonte. Nunca é usado "
            "sozinho como chave de conciliação, porque já foi observado "
            "reaproveitado em lançamentos diferentes."
        ),
    )

    @field_validator("valor")
    @classmethod
    def _valor_deve_ser_positivo(cls, valor: Decimal) -> Decimal:
        return normalizar_valor(valor)

    @property
    def fingerprint(self) -> str:
        """Chave de conciliação composta a partir do conteúdo do movimento.

        Ver `mercurio_domain.fingerprint`.
        """
        return calcular_fingerprint(
            self.conta_id, self.data, self.valor, self.descricao, self.tipo
        )


def encontrar_duplicidades(movimentos: list[Movimento]) -> list[list[Movimento]]:
    """Agrupa movimentos com o mesmo fingerprint E o mesmo identificador
    externo: o caso de uma mesma linha de origem importada mais de uma vez.

    Movimentos com o mesmo fingerprint mas identificador externo diferente
    não entram aqui. Podem ser duplicidade real (o identificador foi
    reaproveitado) ou dois eventos legítimos e coincidentemente iguais; sem
    mais contexto, a decisão fica para revisão humana, não é resolvida
    automaticamente.
    """
    grupos: dict[tuple[str, str | None], list[Movimento]] = {}
    for movimento in movimentos:
        chave = (movimento.fingerprint, movimento.identificador_externo)
        grupos.setdefault(chave, []).append(movimento)
    return [grupo for grupo in grupos.values() if len(grupo) > 1]


class Conta(BaseModel):
    """Uma conta conectada no Pluggy. `nome`, `saldo` e (para cartão de
    crédito) `limite`/`disponivel` vêm sempre da própria Pluggy, atualizados
    a cada sincronização; nunca fixos no código."""

    id: str
    nome: str
    tipo: str  # "BANK" ou "CREDIT"
    saldo: Decimal
    limite: Decimal | None = None
    disponivel: Decimal | None = None


class ResumoFinanceiro(BaseModel):
    atualizado_em: date
    contas: list[Conta]
