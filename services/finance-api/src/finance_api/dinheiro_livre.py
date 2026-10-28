"""Quanto dá para gastar até o próximo pagamento.

Lógica pura, sem banco. As regras e as decisões por trás delas estão em
`docs/specs/2026-10-22-dinheiro-livre.md`.

O Mercúrio guarda só o saldo atual de cada conta, não a foto de cada dia.
Por isso a cota do dia é reconstruída a partir do livre de hoje mais o que
já foi gasto no ciclo; com isso cota dos dias que faltam mais cofrinho é
sempre igual ao livre, e a conta fecha no último dia.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from finance_api.compromissos import parcelas, somar_meses

CENTAVO = Decimal("0.01")


@dataclass(frozen=True)
class ContaFixa:
    nome: str
    valor: Decimal
    data_prevista: date
    origem: str  # "recorrencia" ou "compromisso"
    atrasada: bool


@dataclass(frozen=True)
class RecorrenciaAprovada:
    """Conta fixa ou parcelamento; parcelamento tem `fim_previsto`."""

    nome: str
    valor: Decimal
    ultima_data: date
    fim_previsto: date | None = None


@dataclass(frozen=True)
class CompromissoAtivo:
    nome: str
    valor_parcela: Decimal
    data_inicio: date
    data_fim: date


@dataclass(frozen=True)
class DinheiroLivre:
    saldo_contas: Decimal
    cartao_usado: Decimal
    contas_fixas: list[ContaFixa]
    contas_fixas_total: Decimal
    caixinha: Decimal
    livre: Decimal
    dias_do_ciclo: int
    dias_restantes: int
    cota_do_dia: Decimal
    cofrinho: Decimal
    gasto_hoje: Decimal
    hoje_disponivel: Decimal
    gastos_por_dia: dict[date, Decimal]


def _centavos(valor: Decimal) -> Decimal:
    return valor.quantize(CENTAVO, rounding=ROUND_HALF_UP)


def contas_fixas_pendentes(
    recorrencias: list[RecorrenciaAprovada],
    compromissos: list[CompromissoAtivo],
    *,
    hoje: date,
    inicio: date,
    fim: date,
) -> list[ContaFixa]:
    """Contas fixas que ainda vão sair até a véspera do pagamento.

    Recorrência: a próxima cobrança é um mês depois da última vista no
    extrato. Se essa data cai no ciclo, ela está pendente; se já passou de
    hoje e a cobrança não apareceu, continua pendente e marcada como
    atrasada. Prevista antes do início do ciclo é cobrança que parou de vir,
    e não entra.

    Compromisso não é conciliado com o extrato, então não dá para saber se a
    parcela já foi paga: entra só a parcela de hoje em diante.
    """
    pendentes = []
    for recorrencia in recorrencias:
        prevista = somar_meses(recorrencia.ultima_data, 1)
        acabou = recorrencia.fim_previsto is not None and prevista > recorrencia.fim_previsto
        if inicio <= prevista <= fim and not acabou:
            pendentes.append(
                ContaFixa(recorrencia.nome, recorrencia.valor, prevista, "recorrencia", prevista < hoje)
            )
    for compromisso in compromissos:
        for data in parcelas(compromisso.data_inicio, compromisso.data_fim):
            if hoje <= data <= fim:
                pendentes.append(
                    ContaFixa(compromisso.nome, compromisso.valor_parcela, data, "compromisso", False)
                )
    return sorted(pendentes, key=lambda conta: (conta.data_prevista, conta.nome))


def calcular(
    *,
    hoje: date,
    inicio: date,
    fim: date,
    saldo_contas: Decimal,
    cartao_usado: Decimal,
    contas_fixas: list[ContaFixa],
    gastos_por_dia: dict[date, Decimal],
    caixinha: Decimal = Decimal(0),
) -> DinheiroLivre:
    """`gastos_por_dia` é só o gasto do dia a dia do ciclo até hoje: sem
    pagamento de fatura e sem conta fixa, que já estão descontados à parte.
    """
    contas_fixas_total = sum((conta.valor for conta in contas_fixas), Decimal(0))
    livre = saldo_contas - cartao_usado - contas_fixas_total - caixinha

    dias_do_ciclo = (fim - inicio).days + 1
    dias_restantes = (fim - hoje).days + 1
    gasto_hoje = gastos_por_dia.get(hoje, Decimal(0))
    gasto_antes_de_hoje = sum(
        (valor for dia, valor in gastos_por_dia.items() if dia < hoje), Decimal(0)
    )

    # O livre do começo do ciclo, reconstruído: o de hoje mais o que já saiu
    # no dia a dia desde então.
    cota = _centavos((livre + gasto_antes_de_hoje + gasto_hoje) / dias_do_ciclo)
    dias_passados = dias_do_ciclo - dias_restantes
    cofrinho = cota * dias_passados - gasto_antes_de_hoje

    dias = {inicio + timedelta(days=indice): Decimal(0) for indice in range(dias_passados + 1)}
    dias.update({dia: valor for dia, valor in gastos_por_dia.items() if inicio <= dia <= hoje})

    return DinheiroLivre(
        saldo_contas=saldo_contas,
        cartao_usado=cartao_usado,
        contas_fixas=contas_fixas,
        contas_fixas_total=contas_fixas_total,
        caixinha=caixinha,
        livre=livre,
        dias_do_ciclo=dias_do_ciclo,
        dias_restantes=dias_restantes,
        cota_do_dia=cota,
        cofrinho=cofrinho,
        gasto_hoje=gasto_hoje,
        hoje_disponivel=cota + cofrinho - gasto_hoje,
        gastos_por_dia=dict(sorted(dias.items())),
    )
