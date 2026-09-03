"""Modelo de domínio do Mercúrio: titularidades, movimentos e reserva do DAS.

Titularidade, tipo de movimento e o cálculo de fingerprint vêm do pacote
compartilhado `mercurio_domain`, para que finance-api e ingestion-worker
nunca divirjam na regra de conciliação. Ver `mercurio_domain` para o porquê.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from mercurio_domain import (
    Proveniencia,
    TipoMovimento,
    Titularidade,
    normalizar_valor,
)
from mercurio_domain import (
    fingerprint as calcular_fingerprint,
)
from pydantic import BaseModel, Field, field_validator

__all__ = [
    "Movimento",
    "ObrigacaoDas",
    "Proveniencia",
    "ResumoFinanceiro",
    "ResumoTitularidade",
    "TipoMovimento",
    "Titularidade",
    "encontrar_duplicidades",
]


class Movimento(BaseModel):
    """Um lançamento financeiro já classificado por titularidade."""

    titularidade: Titularidade
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
            self.titularidade, self.data, self.valor, self.descricao, self.tipo
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


class ResumoTitularidade(BaseModel):
    titularidade: Titularidade
    nome: str
    saldo: Decimal


class ObrigacaoDas(BaseModel):
    """O DAS-MEI é um valor fixo mensal (não percentual de faturamento).

    Não é derivado de movimento importado: nada no extrato conectado hoje
    mostra o pagamento do DAS, porque ele sai da conta PJ, que não está
    conectada no Pluggy (ver docs/domain-rules.md). `paga` é marcada à
    mão via POST /das/pagar, não inferida automaticamente.
    """

    competencia: str  # "AAAA-MM"
    valor: Decimal
    paga: bool


class ResumoFinanceiro(BaseModel):
    atualizado_em: date
    titularidades: list[ResumoTitularidade]
    obrigacao_das: ObrigacaoDas
