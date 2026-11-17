"""Categorias do Mercúrio e de onde cada movimento tira a sua.

A Pluggy classifica com modelo próprio e chama de transferência quase todo
Pix, então a categoria dela sozinha não serve para média por categoria. A
ordem de decisão é fixa: correção do dono, depois regra por destinatário,
depois a categoria da Pluggy traduzida. Sem nenhuma das três, o movimento
fica "para classificar".

As categorias moram na tabela `categorias`, criada e preenchida pela
migração. Os ids usados aqui precisam existir lá, e um teste confere.
"""

from __future__ import annotations

import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass
from enum import Enum


class OrigemDaCategoria(str, Enum):
    """De onde veio a categoria. `dono` e `mobills` foram escolha do dono e
    nunca são recalculadas; `regra` e `pluggy` são automáticas."""

    DONO = "dono"
    MOBILLS = "mobills"
    REGRA = "regra"
    PLUGGY = "pluggy"


ORIGENS_DO_DONO = (OrigemDaCategoria.DONO.value, OrigemDaCategoria.MOBILLS.value)

# As categorias que as migrações criam. O resto foi o dono que criou, ou um
# teste: é o que a limpeza do banco de teste e da demonstração apaga. Pela
# ordem não dá, porque a das categorias de entrada depende do que já existia
# no banco quando a migração rodou. Um teste confere esta lista contra a tabela.
CATEGORIAS_DAS_MIGRACOES = (
    "alimentacao", "supermercado", "transporte", "saude", "farmacia", "viagem", "hospedagem",
    "casa", "assinaturas", "educacao", "compras", "vestuario", "lazer", "servicos",
    "presentes-e-doacoes", "pix-para-pessoas", "investimento-e-reserva", "salario-e-extras",
    "taxas-e-tarifas", "outros", "rendimentos", "vendas", "presentes-recebidos", "outras-entradas",
)

# Só receita e despesa pedem categoria. Transferência entre contas do titular
# e pagamento de fatura movem o próprio dinheiro e não entram em média de gasto.
TIPOS_CLASSIFICAVEIS = ("despesa", "receita")

# Árvore da Pluggy (GET /categories) para as categorias do Mercúrio. Vale o
# prefixo mais longo: `1802` (Pharmacy) vence `18` (Healthcare). Família sem
# entrada fica para classificar: `04` e `05` são transferência, que não diz
# para que o dinheiro foi, e `03` é aplicação e resgate, salvo o rendimento.
TRADUCAO_DA_PLUGGY = {
    "01": "salario-e-extras",
    "0201": "taxas-e-tarifas",
    "0202": "taxas-e-tarifas",
    "0306": "rendimentos",
    "07": "servicos",
    "0702": "educacao",
    "0703": "saude",
    "0704": "lazer",
    "08": "compras",
    "0804": "vestuario",
    "0806": "educacao",
    "0809": "salario-e-extras",
    "09": "assinaturas",
    "10": "supermercado",
    "11": "alimentacao",
    "12": "viagem",
    "1202": "hospedagem",
    "13": "presentes-e-doacoes",
    "14": "lazer",
    "15": "taxas-e-tarifas",
    "16": "taxas-e-tarifas",
    "17": "casa",
    "18": "saude",
    "1802": "farmacia",
    "19": "transporte",
    "20": "servicos",
    "21": "lazer",
    "99": "outros",
}

# As 24 categorias do Mobills juntadas nas 19 do Mercúrio. As raras foram para
# a vizinha: categoria com uma ou duas linhas no ano nunca forma média.
DO_MOBILLS = {
    "alimentacao": "alimentacao",
    "supermercado": "supermercado",
    "transporte": "transporte",
    "saude": "saude",
    "drogas": "farmacia",
    "viagem": "viagem",
    "casa": "casa",
    "assinatura": "assinaturas",
    "educacao": "educacao",
    "livraria": "educacao",
    "compras": "compras",
    "vestuario": "vestuario",
    "lazer": "lazer",
    "servicos": "servicos",
    "presente": "presentes-e-doacoes",
    "doacao": "presentes-e-doacoes",
    "pix": "pix-para-pessoas",
    "investimento": "investimento-e-reserva",
    "reserva de emergencia": "investimento-e-reserva",
    "salario": "salario-e-extras",
    "bonificacao": "salario-e-extras",
    "renda extra": "salario-e-extras",
    "operacao bancaria": "taxas-e-tarifas",
    "outros": "outros",
}


def sem_acento(texto: str) -> str:
    decomposto = unicodedata.normalize("NFKD", texto)
    return "".join(letra for letra in decomposto if not unicodedata.combining(letra)).strip().lower()


def chave_do_destinatario(descricao: str) -> str:
    """A quem o movimento se refere. A Pluggy escreve o Pix como
    "Transferência enviada|Nome", e a parte que identifica é o nome; sem a
    barra, a descrição inteira já identifica (estabelecimento, empresa)."""
    partes = descricao.split("|", 1)
    return (partes[1] if len(partes) == 2 else partes[0]).strip().lower()


def traduzir_da_pluggy(categoria_id: str | None) -> str | None:
    if not categoria_id:
        return None
    for tamanho in (4, 2):
        categoria = TRADUCAO_DA_PLUGGY.get(categoria_id[:tamanho])
        if categoria is not None:
            return categoria
    return None


def categoria_do_mobills(nome: str) -> str | None:
    return DO_MOBILLS.get(sem_acento(nome))


@dataclass(frozen=True)
class Regra:
    """O que se sabe de um destinatário. `categoria` nula quer dizer misto:
    ele já recebeu por coisas diferentes e cada movimento novo é perguntado."""

    categoria: str | None


def decidir(
    *,
    tipo: str,
    fatura: bool,
    regra: Regra | None,
    categoria_id_da_pluggy: str | None,
    tipos_das_categorias: Mapping[str, str],
) -> tuple[str | None, str | None]:
    """Categoria automática e sua origem, para movimento sem escolha do dono.
    `(None, None)` é "para classificar" ou, fora dos tipos classificáveis,
    "não se aplica".

    A categoria automática tem o tipo do movimento. Receita em categoria de
    despesa é reembolso e só o dono escolhe: a regra de um destinatário vem
    dos Pix enviados a ele e marcaria o Pix que ele devolveu."""
    if tipo not in TIPOS_CLASSIFICAVEIS or fatura:
        return None, None
    if regra is not None:
        if regra.categoria is None:
            return None, None
        if tipos_das_categorias.get(regra.categoria) == tipo:
            return regra.categoria, OrigemDaCategoria.REGRA.value
        # Regra de outro tipo não diz nada deste movimento: segue para a
        # Pluggy, que reconhece, por exemplo, o rendimento.
    traduzida = traduzir_da_pluggy(categoria_id_da_pluggy)
    if traduzida is not None and tipos_das_categorias.get(traduzida) == tipo:
        return traduzida, OrigemDaCategoria.PLUGGY.value
    return None, None
