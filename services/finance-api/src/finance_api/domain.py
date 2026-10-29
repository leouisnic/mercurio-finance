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

from finance_api.categorias import OrigemDaCategoria

__all__ = [
    "CategoriaIn",
    "CategoriaJaUsada",
    "CategoriaOut",
    "CategoriaRecorrencia",
    "CategoriaUpdate",
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
    "GastoPorCategoria",
    "ImpactoOut",
    "LoteIn",
    "LoteOut",
    "Movimento",
    "MovimentoOut",
    "PagamentoFaturaUpdate",
    "ParaClassificarOut",
    "Proveniencia",
    "RecorrenciaOut",
    "RecorrenciaUpdate",
    "ResumoDaTagOut",
    "ResumoFinanceiro",
    "StatusCompromisso",
    "StatusRecorrencia",
    "TagIn",
    "TagOut",
    "TagUpdate",
    "TagsUpdate",
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
    item_id: str | None = Field(
        default=None,
        description="Conexão bancária de origem: contas da mesma conexão são do mesmo banco.",
    )
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


class CategoriaJaUsada(BaseModel):
    categoria: str
    vezes: int


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
    categoria_propria: str | None = Field(
        default=None,
        description="Categoria do Mercúrio. Nula em receita ou despesa é para classificar.",
    )
    origem_da_categoria: OrigemDaCategoria | None = None
    historico: list[CategoriaJaUsada] = Field(
        default_factory=list,
        description="Categorias que o dono já deu a este destinatário, só na fila para classificar.",
    )
    tags: list[str] = Field(default_factory=list)


class CategoriaOut(BaseModel):
    id: str
    nome: str
    icone: str = Field(description="Nome do ícone no lucide-react.")
    cor: int = Field(description="Tom da cor, de 0 a 359.")


class CategoriaIn(BaseModel):
    """Categoria criada pelo dono. O ícone é validado só pelo formato: o
    painel mostra um ícone neutro para nome que não conhece."""

    nome: str = Field(min_length=1, max_length=60)
    icone: str = Field(pattern=r"^[A-Za-z0-9]{1,40}$")
    cor: int = Field(ge=0, le=359)

    @field_validator("nome")
    @classmethod
    def nome_sem_espacos_nas_pontas(cls, nome: str) -> str:
        if not nome.strip():
            raise ValueError("nome vazio")
        return nome.strip()


class TagsUpdate(BaseModel):
    tags: list[str] = Field(max_length=20)

    @field_validator("tags")
    @classmethod
    def tags_curtas(cls, tags: list[str]) -> list[str]:
        if any(len(tag.strip()) > 60 for tag in tags):
            raise ValueError("tag com mais de 60 caracteres")
        return tags


class LoteIn(BaseModel):
    """A mesma categoria, a mesma tag ou as duas para vários movimentos."""

    ids: list[int] = Field(min_length=1, max_length=500)
    categoria: str | None = None
    tag: str | None = Field(default=None, min_length=1, max_length=60)

    @model_validator(mode="after")
    def alguma_marca(self) -> LoteIn:
        if self.categoria is None and self.tag is None:
            raise ValueError("informe categoria ou tag")
        return self


class LoteOut(BaseModel):
    alterados: int


class CicloOut(BaseModel):
    """Um ciclo de pagamento já resolvido em datas. Quem calcula é
    `finance_api.ciclo`; o painel só consome."""

    numero: int
    inicio: date
    fim: date


class TagIn(BaseModel):
    """Tag criada antes de ter movimento, com teto e período opcionais."""

    nome: str = Field(min_length=1, max_length=60)
    icone: str = Field(default="Tag", pattern=r"^[A-Za-z0-9]{1,40}$")
    cor: int = Field(default=278, ge=0, le=359)
    teto: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    inicio: date | None = None
    fim: date | None = None

    @field_validator("nome")
    @classmethod
    def nome_sem_espacos_nas_pontas(cls, nome: str) -> str:
        if not nome.strip():
            raise ValueError("nome vazio")
        return nome.strip()

    @model_validator(mode="after")
    def periodo_em_ordem(self) -> TagIn:
        if self.inicio and self.fim and self.fim < self.inicio:
            raise ValueError("o fim do período vem antes do início")
        return self


class TagUpdate(BaseModel):
    """Campo ausente fica como está; `teto`, `inicio` e `fim` em `null` apagam."""

    nome: str | None = Field(default=None, min_length=1, max_length=60)
    icone: str | None = Field(default=None, pattern=r"^[A-Za-z0-9]{1,40}$")
    cor: int | None = Field(default=None, ge=0, le=359)
    teto: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    inicio: date | None = None
    fim: date | None = None
    arquivada: bool | None = None


class TagOut(BaseModel):
    id: int
    nome: str
    icone: str
    cor: int
    teto: Decimal | None
    inicio: date | None
    fim: date | None
    arquivada: bool
    gasto: Decimal = Field(description="Despesas marcadas, sem pagamento de fatura.")
    quantidade: int
    primeira_data: date | None
    ultima_data: date | None


class GastoPorCategoria(BaseModel):
    categoria: str | None
    total: Decimal


class GastoMarcado(BaseModel):
    data: date
    descricao: str
    valor: Decimal


class TotalDoDia(BaseModel):
    data: date
    total: Decimal


class CategoriaPrincipal(BaseModel):
    categoria: str
    total: Decimal
    tipico_por_ciclo: Decimal | None = Field(
        description="Média do gasto nessa categoria nos ciclos de comparação."
    )


class BarraDoCicloOut(BaseModel):
    ciclo: CicloOut
    gasto_sem_a_tag: Decimal
    gasto_da_tag: Decimal


class ImpactoOut(BaseModel):
    """Ver `finance_api.tags`: típico é a média dos ciclos anteriores, rombo é
    quanto o ciclo da tag passou dele, e recupera em divide o rombo pela sobra
    média desses ciclos."""

    ciclo: CicloOut
    gasto: Decimal
    tipico: Decimal
    rombo: Decimal
    rombo_da_tag: Decimal = Field(description="O rombo limitado ao que a tag gastou no ciclo.")
    sobra_media: Decimal
    ciclos_para_recuperar: int | None
    barras: list[BarraDoCicloOut]


class ResumoDaTagOut(TagOut):
    por_categoria: list[GastoPorCategoria]
    dias: int
    por_dia: Decimal
    maiores: list[GastoMarcado]
    dia_mais_caro: TotalDoDia | None
    acumulado: list[TotalDoDia]
    categoria_principal: CategoriaPrincipal | None
    impacto: ImpactoOut | None


class CategoriaUpdate(BaseModel):
    """A escolha do dono para um movimento. `todos_do_destinatario` vira
    regra e alcança os antigos dele que o Mercúrio classificou sozinho."""

    categoria: str
    todos_do_destinatario: bool = False


class ParaClassificarOut(BaseModel):
    total: int


class PagamentoFaturaUpdate(BaseModel):
    """Corrige a conclusão do Mercúrio sobre um movimento: marcar que é
    pagamento de fatura (mesmo sem ter sido detectado) ou que não é."""

    estado: DecisaoPagamentoFatura


class GastoDoDetalhe(BaseModel):
    """Um dos maiores gastos do dia, para o detalhe do gráfico."""

    descricao: str
    valor: Decimal


class GastoDiario(BaseModel):
    """Soma das despesas (`tipo == despesa`) de um dia. Pagamento de fatura
    fica fora, para não contar o mesmo gasto duas vezes."""

    data: date
    total: Decimal
    maiores: list[GastoDoDetalhe] = Field(default_factory=list)
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
    fatura_paga: Decimal = Field(
        default=Decimal(0),
        description="Pagamento de fatura de cartão saído desta conta. Não é gasto.",
    )
    transferencias_entrada: Decimal = Field(
        default=Decimal(0),
        description="Dinheiro vindo de outra conta do titular, inclusive resgate.",
    )
    transferencias_saida: Decimal = Field(
        default=Decimal(0),
        description="Dinheiro enviado a outra conta do titular, inclusive aplicação.",
    )


class CiclosOut(BaseModel):
    atual: CicloOut
    anterior: CicloOut
    seguinte: CicloOut


class ContaFixaOut(BaseModel):
    nome: str
    valor: Decimal
    data_prevista: date
    origem: Literal["recorrencia", "compromisso"]
    atrasada: bool


class GastoDoDiaOut(BaseModel):
    data: date
    total: Decimal
    maiores: list[GastoDoDetalhe] = Field(default_factory=list)


class DinheiroLivreOut(BaseModel):
    """Quanto dá para gastar até a véspera do próximo pagamento. A regra
    está em `finance_api.dinheiro_livre`."""

    hoje: date
    ciclo: CicloOut
    ciclo_seguinte: CicloOut
    saldo_contas: Decimal
    cartao_usado: Decimal
    contas_fixas: list[ContaFixaOut]
    contas_fixas_total: Decimal
    caixinha: Decimal
    livre: Decimal
    dias_do_ciclo: int
    dias_restantes: int
    cota_do_dia: Decimal
    cofrinho: Decimal
    gasto_hoje: Decimal
    hoje_disponivel: Decimal
    gastos_por_dia: list[GastoDoDiaOut]


class StatusRecorrencia(str, Enum):
    """`aprovada` é conta fixa, sem fim; `parcelamento` tem fim previsto;
    `encerrada` foi recorrente e parou; `rejeitada` nunca foi recorrência."""

    PENDENTE = "pendente"
    APROVADA = "aprovada"
    PARCELAMENTO = "parcelamento"
    ENCERRADA = "encerrada"
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
    fim_previsto: date | None = Field(
        default=None, description="Data da última parcela. Só para parcelamento."
    )


class RecorrenciaUpdate(BaseModel):
    """Classifica e/ou decide uma recorrência. Campo não enviado fica como
    está, então dá para aprovar já classificando numa tacada só."""

    apelido: str | None = Field(default=None, min_length=1, max_length=100)
    categoria: CategoriaRecorrencia | None = None
    status: StatusRecorrencia | None = None
    parcelas_restantes: int | None = Field(
        default=None,
        ge=1,
        le=120,
        description="Quantas parcelas ainda faltam. Obrigatório só para parcelamento.",
    )

    @model_validator(mode="after")
    def parcelas_so_no_parcelamento(self) -> RecorrenciaUpdate:
        e_parcelamento = self.status == StatusRecorrencia.PARCELAMENTO
        if e_parcelamento and self.parcelas_restantes is None:
            raise ValueError("parcelamento precisa de parcelas_restantes")
        if self.parcelas_restantes is not None and not e_parcelamento:
            raise ValueError("parcelas_restantes só vale para parcelamento")
        return self


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
