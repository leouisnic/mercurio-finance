"""Modelo de domínio do Mercúrio: contas e movimentos.

Tipo de movimento e o cálculo de fingerprint vêm do pacote compartilhado
`mercurio_domain`, para que finance-api e ingestion-worker nunca divirjam
na regra de conciliação. Ver `mercurio_domain` para o porquê.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Literal

from mercurio_domain import Proveniencia, TipoMovimento, normalizar_valor
from mercurio_domain import (
    fingerprint as calcular_fingerprint,
)
from pydantic import BaseModel, Field, field_validator, model_validator

__all__ = [
    "CategoriaRecorrencia",
    "CicloOut",
    "CiclosOut",
    "CompromissoIn",
    "CompromissoOut",
    "CompromissoUpdate",
    "Conta",
    "ContaUpdate",
    "DecisaoPagamentoFatura",
    "EstadoPagamentoFatura",
    "FluxoDaConta",
    "GastoDiario",
    "Movimento",
    "MovimentoOut",
    "PagamentoFaturaUpdate",
    "Proveniencia",
    "RecorrenciaOut",
    "RecorrenciaUpdate",
    "ResumoFinanceiro",
    "StatusCompromisso",
    "StatusRecorrencia",
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
    crédito) `limite`/`disponivel`/`bandeira`/`final`/`fechamento`/
    `vencimento` vêm sempre da própria Pluggy, atualizados a cada
    sincronização; nunca fixos no código."""

    id: str
    nome: str
    apelido: str | None = Field(
        default=None,
        description="Nome escolhido na revisão, no lugar do que a Pluggy devolve.",
    )
    tipo: str  # "BANK" ou "CREDIT"
    saldo: Decimal
    limite: Decimal | None = None
    disponivel: Decimal | None = None
    bandeira: str | None = None
    final: str | None = None
    fechamento: date | None = Field(
        default=None, description="Dia em que a fatura em aberto fecha. Só para CREDIT."
    )
    vencimento: date | None = Field(
        default=None, description="Dia em que a fatura em aberto vence. Só para CREDIT."
    )


class ContaUpdate(BaseModel):
    """Renomeia uma conta. `apelido` nulo volta a mostrar o nome da Pluggy."""

    apelido: str | None = Field(default=None, min_length=1, max_length=100)


class ResumoFinanceiro(BaseModel):
    atualizado_em: datetime | None = Field(
        default=None,
        description=(
            "Data e hora da conta mais recentemente sincronizada. "
            "None quando nenhuma conta foi sincronizada ainda."
        ),
    )
    contas: list[Conta]


class EstadoPagamentoFatura(str, Enum):
    """Conclusão sobre uma saída bancária que paga uma fatura.

    `detectado` é automático; `confirmado` e `descartado` dependem de
    decisão humana. Movimento comum não tem estado.
    """

    DETECTADO = "detectado"
    CONFIRMADO = "confirmado"
    DESCARTADO = "descartado"


class DecisaoPagamentoFatura(str, Enum):
    """Estados que podem ser informados pela revisão humana."""

    CONFIRMADO = "confirmado"
    DESCARTADO = "descartado"


class MovimentoOut(BaseModel):
    """Um movimento já gravado, para listagem (`GET /movimentos`)."""

    id: int
    conta_id: str
    data: date
    valor: Decimal
    descricao: str
    tipo: TipoMovimento
    proveniencia: Proveniencia
    categoria: str | None = Field(
        default=None, description="Categoria como a Pluggy classificou, quando há."
    )
    duplicado_possivel: bool = False
    pagamento_de_fatura: EstadoPagamentoFatura | None = None


class PagamentoFaturaUpdate(BaseModel):
    """Corrige a conclusão do Mercúrio sobre um movimento: marcar que é
    pagamento de fatura (mesmo sem ter sido detectado) ou que não é."""

    estado: DecisaoPagamentoFatura


class GastoDiario(BaseModel):
    """Soma das despesas (`tipo == despesa`) de um dia. Pagamento de fatura
    fica fora, para não contar o mesmo gasto duas vezes."""

    data: date
    total: Decimal
    em_revisao: Decimal = Field(
        description="Parcela do total marcada como possível duplicidade."
    )


class FluxoDaConta(BaseModel):
    """Entradas e saídas de uma conta num intervalo. Pagamento de fatura
    fica fora das saídas, para não contar o mesmo gasto duas vezes."""

    conta_id: str
    nome: str
    apelido: str | None = None
    tipo: str
    entradas: Decimal
    saidas: Decimal
    em_revisao: Decimal = Field(
        description="Parcela das saídas marcada como possível duplicidade."
    )


class CicloOut(BaseModel):
    """Um ciclo de pagamento já resolvido em datas. Quem calcula é
    `finance_api.ciclo`; o painel só consome."""

    numero: int
    inicio: date
    fim: date


class CiclosOut(BaseModel):
    atual: CicloOut
    anterior: CicloOut
    seguinte: CicloOut


class StatusRecorrencia(str, Enum):
    PENDENTE = "pendente"
    APROVADA = "aprovada"
    REJEITADA = "rejeitada"


class CategoriaRecorrencia(str, Enum):
    """Categoria pessoal, independente da classificação da Pluggy.

    A categoria bancária pode tratar despesas de naturezas diferentes como
    transferências. A lista curta permite agrupamento consistente.
    """

    SAUDE = "saude"
    FAMILIA = "familia"
    MORADIA = "moradia"
    ASSINATURA = "assinatura"
    TRANSPORTE = "transporte"
    ALIMENTACAO = "alimentacao"
    OUTROS = "outros"


class RecorrenciaOut(BaseModel):
    """Um padrão de despesa repetida encontrado no histórico.

    Nasce `pendente`: a detecção sugere e uma pessoa decide. Ver
    `finance_api.recorrencias` para a regra.
    """

    id: int
    conta_id: str
    descricao: str
    apelido: str | None = Field(
        default=None,
        description="Nome legível definido na revisão, no lugar da descrição bancária.",
    )
    categoria: CategoriaRecorrencia | None = None
    valor_medio: Decimal
    ocorrencias: int
    primeira_data: date
    ultima_data: date
    status: StatusRecorrencia


class RecorrenciaUpdate(BaseModel):
    """Classifica e/ou decide uma recorrência. Campo não enviado fica como
    está, então dá para aprovar já classificando numa tacada só."""

    apelido: str | None = Field(default=None, min_length=1, max_length=100)
    categoria: CategoriaRecorrencia | None = None
    status: StatusRecorrencia | None = None


class StatusCompromisso(str, Enum):
    ATIVO = "ativo"
    QUITADO = "quitado"
    CANCELADO = "cancelado"


class CompromissoIn(BaseModel):
    """Cadastro de uma obrigação futura (pela tela ou, quando existir,
    pelo bot do Telegram)."""

    descricao: str = Field(min_length=1, max_length=500)
    valor_parcela: Decimal
    data_inicio: date
    data_fim: date = Field(
        description=(
            "Obrigatória de propósito: compromisso tem prazo para acabar "
            "(pagar alguém em N vezes), diferente de assinatura."
        )
    )
    periodicidade: Literal["mensal"] = "mensal"
    conta_id: str | None = Field(
        default=None, description="Conta prevista para a saída, quando conhecida."
    )

    @field_validator("valor_parcela")
    @classmethod
    def _valor_deve_ser_positivo(cls, valor: Decimal) -> Decimal:
        return normalizar_valor(valor)

    @model_validator(mode="after")
    def _fim_nao_pode_ser_antes_do_inicio(self) -> CompromissoIn:
        if self.data_fim < self.data_inicio:
            raise ValueError("data_fim não pode ser anterior a data_inicio")
        return self


class CompromissoUpdate(BaseModel):
    """Edição parcial. Campo não enviado fica como está (o endpoint usa
    `exclude_unset`), então dá para mandar só `status` para quitar ou
    cancelar."""

    descricao: str | None = Field(default=None, min_length=1, max_length=500)
    valor_parcela: Decimal | None = None
    data_inicio: date | None = None
    data_fim: date | None = None
    periodicidade: Literal["mensal"] | None = None
    conta_id: str | None = None
    status: StatusCompromisso | None = None


class CompromissoOut(BaseModel):
    """Compromisso cadastrado, com a projeção de parcelas já calculada.

    `proxima_parcela`/`parcelas_restantes` são calendário puro (ver
    `finance_api.compromissos`), não conciliação: o sistema não tenta
    adivinhar se a parcela foi paga olhando os movimentos reais.
    """

    id: int
    descricao: str
    valor_parcela: Decimal
    data_inicio: date
    data_fim: date
    periodicidade: str
    conta_id: str | None
    status: StatusCompromisso
    proxima_parcela: date | None
    parcelas_total: int
    parcelas_restantes: int
    valor_restante: Decimal
