"""Quanto dá para gastar até o próximo pagamento.

Lógica pura, sem banco. As regras e as decisões por trás delas estão em
`docs/specs/2026-10-22-dinheiro-livre.md`.

O Mercúrio guarda só o saldo atual de cada conta, não a foto de cada dia.
Por isso a cota do dia é reconstruída a partir do livre de hoje mais o que
já foi gasto no ciclo; com isso cota dos dias que faltam mais cofrinho é
sempre igual ao livre, e a conta fecha no último dia.

Dinheiro guardado (aplicação vista pela Pluggy) sai do saldo como um gasto,
mas não é gasto: ele entra de volta na reconstrução e sai só da cota dos dias
de quando foi aplicado até o fim do ciclo. Assim o cofrinho dos dias que já
passaram não muda. O resgate faz o contrário. As regras estão em
`docs/specs/2026-11-07-dinheiro-livre-e-plano-do-ciclo.md`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_FLOOR, Decimal
from statistics import median

from finance_api.centavos import centavos as _centavos
from finance_api.compromissos import parcelas, somar_meses

# Com menos ciclos completos que isso a mediana não diz nada do costume do dono,
# e a recomendação de quanto guardar some em vez de inventar um valor.
MINIMO_DE_CICLOS_PARA_ESTIMAR = 2
CICLOS_DA_ESTIMATIVA = 6
# A recomendação é arredondada para baixo em dezenas de reais: centavo numa
# sugestão de quanto guardar dá falsa precisão.
PASSO_DA_RECOMENDACAO = Decimal(10)


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
    guardado_no_ciclo: Decimal
    guardado_em: date | None
    da_para_guardar: Decimal | None
    falta_para_fechar: Decimal


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


def estimar_dia_a_dia(medias_por_dia: list[Decimal]) -> Decimal | None:
    """Quanto o dia a dia costuma custar por dia: a mediana das médias por dia
    dos ciclos completos recentes. Mediana para um ciclo atípico, como uma
    viagem, não puxar o valor."""
    if len(medias_por_dia) < MINIMO_DE_CICLOS_PARA_ESTIMAR:
        return None
    return _centavos(median(medias_por_dia))


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
    guardado_por_dia: dict[date, Decimal] | None = None,
    estimativa_por_dia: Decimal | None = None,
) -> DinheiroLivre:
    """`gastos_por_dia` é só o gasto do dia a dia do ciclo até hoje: sem
    pagamento de fatura e sem conta fixa, que já estão descontados à parte.
    `guardado_por_dia` é o aplicado menos o resgatado em cada dia do ciclo.
    """
    contas_fixas_total = sum((conta.valor for conta in contas_fixas), Decimal(0))
    livre = saldo_contas - cartao_usado - contas_fixas_total - caixinha

    dias_do_ciclo = (fim - inicio).days + 1
    dias_restantes = (fim - hoje).days + 1
    gasto_hoje = gastos_por_dia.get(hoje, Decimal(0))
    gasto_antes_de_hoje = sum(
        (valor for dia, valor in gastos_por_dia.items() if dia < hoje), Decimal(0)
    )

    guardado = {dia: valor for dia, valor in (guardado_por_dia or {}).items() if inicio <= dia <= hoje}
    guardado_no_ciclo = sum(guardado.values(), Decimal(0))

    # O livre do começo do ciclo, reconstruído: o de hoje mais o que já saiu
    # no dia a dia desde então e o que foi guardado.
    cota_do_comeco = (livre + gasto_antes_de_hoje + gasto_hoje + guardado_no_ciclo) / dias_do_ciclo

    def cota_em(dia: date) -> Decimal:
        retirado = sum(
            (valor / ((fim - aplicado_em).days + 1) for aplicado_em, valor in guardado.items() if aplicado_em <= dia),
            Decimal(0),
        )
        return _centavos(cota_do_comeco - retirado)

    dias_passados = dias_do_ciclo - dias_restantes
    cota = cota_em(hoje)
    cofrinho = (
        sum((cota_em(inicio + timedelta(days=indice)) for indice in range(dias_passados)), Decimal(0))
        - gasto_antes_de_hoje
    )

    da_para_guardar = None
    if estimativa_por_dia is not None:
        # O gasto de hoje já saiu do livre e faz parte do dia a dia de hoje.
        sobra = max(livre + gasto_hoje - estimativa_por_dia * dias_restantes, Decimal(0))
        da_para_guardar = _centavos(
            (sobra / PASSO_DA_RECOMENDACAO).to_integral_value(ROUND_FLOOR) * PASSO_DA_RECOMENDACAO
        )
    aplicacoes = [dia for dia, valor in guardado.items() if valor > 0]

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
        # Livre negativo: não há o que gastar hoje, e o que importa é quanto
        # falta para fechar o ciclo.
        hoje_disponivel=Decimal(0) if livre < 0 else cota + cofrinho - gasto_hoje,
        gastos_por_dia=dict(sorted(dias.items())),
        guardado_no_ciclo=guardado_no_ciclo,
        guardado_em=max(aplicacoes) if aplicacoes and guardado_no_ciclo > 0 else None,
        da_para_guardar=da_para_guardar,
        falta_para_fechar=max(-livre, Decimal(0)),
    )
