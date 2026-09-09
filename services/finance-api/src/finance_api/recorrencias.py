"""Detecção de despesa recorrente no histórico já importado.

Lógica pura, sem banco: recebe lançamentos observados e devolve
candidatas. Quem lê do Postgres e grava o resultado é
`finance_api.repositorio`.

A detecção sugere, nunca decide: toda candidata nasce `pendente` e só
vale depois de aprovada. Uma cobrança mensal de mesma descrição e mesmo
valor pode ser assinatura (não acaba) ou parcelamento com prazo (dividir
hospedagem de viagem e pagar por Pix durante 6 meses). As duas são
idênticas olhando só o histórico.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from itertools import pairwise

# Três ocorrências: com duas, qualquer par de compras parecidas com ~1 mês
# de intervalo viraria "recorrência" (falso positivo fácil demais).
MINIMO_OCORRENCIAS = 3
# Mensal na prática varia: cobrança em dia útil, fim de semana, fevereiro.
INTERVALO_MINIMO_DIAS = 28
INTERVALO_MAXIMO_DIAS = 35
# Assinatura reajusta e conta de consumo oscila; 15% acomoda isso sem
# fundir cobranças que só por acaso têm a mesma descrição.
TOLERANCIA_VALOR = Decimal("0.15")


@dataclass(frozen=True)
class LancamentoObservado:
    """Um movimento já gravado, no mínimo que a detecção precisa ver."""

    conta_id: str
    descricao: str
    data: date
    valor: Decimal


@dataclass(frozen=True)
class RecorrenciaCandidata:
    """Padrão encontrado, ainda não aprovado por ninguém."""

    conta_id: str
    descricao: str
    valor_medio: Decimal
    ocorrencias: int
    primeira_data: date
    ultima_data: date


def _continua_a_sequencia(anterior: LancamentoObservado, atual: LancamentoObservado) -> bool:
    dias = (atual.data - anterior.data).days
    if not INTERVALO_MINIMO_DIAS <= dias <= INTERVALO_MAXIMO_DIAS:
        return False
    if anterior.valor <= 0:
        return False
    variacao = abs(atual.valor - anterior.valor) / anterior.valor
    return variacao <= TOLERANCIA_VALOR


def _maior_sequencia(
    lancamentos: Sequence[LancamentoObservado],
) -> list[LancamentoObservado]:
    """A maior sequência de cobranças encadeadas (intervalo e valor
    compatíveis de uma para a seguinte), dentro de uma lista já ordenada
    por data.

    Sequência, não só contagem: um gasto que aconteceu 3 vezes em datas
    espalhadas não é recorrência; 3 vezes encadeadas mês a mês é.
    """
    melhor: list[LancamentoObservado] = []
    atual: list[LancamentoObservado] = [lancamentos[0]]

    for anterior, seguinte in pairwise(lancamentos):
        if _continua_a_sequencia(anterior, seguinte):
            atual.append(seguinte)
            continue
        if len(atual) > len(melhor):
            melhor = atual
        atual = [seguinte]

    return atual if len(atual) > len(melhor) else melhor


def detectar_recorrencias(
    lancamentos: Iterable[LancamentoObservado],
) -> list[RecorrenciaCandidata]:
    """Agrupa por (conta, descrição) e devolve os grupos que formam uma
    sequência mensal de pelo menos `MINIMO_OCORRENCIAS` cobranças.

    A descrição é comparada exata, do mesmo jeito que o fingerprint de
    conciliação faz (ver `mercurio_domain`): sem tentar adivinhar que
    "NETFLIX.COM" e "Netflix *assinatura" são a mesma coisa. Errar para
    menos aqui é barato (a candidata não aparece e ele cadastra à mão);
    errar para mais enche a fila de aprovação de lixo.
    """
    por_chave: dict[tuple[str, str], list[LancamentoObservado]] = defaultdict(list)
    for lancamento in lancamentos:
        por_chave[(lancamento.conta_id, lancamento.descricao)].append(lancamento)

    candidatas: list[RecorrenciaCandidata] = []
    for (conta_id, descricao), grupo in por_chave.items():
        if len(grupo) < MINIMO_OCORRENCIAS:
            continue

        sequencia = _maior_sequencia(sorted(grupo, key=lambda item: item.data))
        if len(sequencia) < MINIMO_OCORRENCIAS:
            continue

        valores = [item.valor for item in sequencia]
        media = (sum(valores) / len(valores)).quantize(Decimal("0.01"))
        candidatas.append(
            RecorrenciaCandidata(
                conta_id=conta_id,
                descricao=descricao,
                valor_medio=media,
                ocorrencias=len(sequencia),
                primeira_data=sequencia[0].data,
                ultima_data=sequencia[-1].data,
            )
        )

    return sorted(candidatas, key=lambda candidata: (candidata.conta_id, candidata.descricao))
