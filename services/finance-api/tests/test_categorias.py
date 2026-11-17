"""Categorias próprias: ordem de decisão, correção do dono, regra por
destinatário e importação do Mobills. Todo dado aqui é fictício."""

import asyncio
import runpy
from datetime import date
from decimal import Decimal
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from finance_api import config
from finance_api.categorias import (
    CATEGORIAS_DAS_MIGRACOES,
    DO_MOBILLS,
    TRADUCAO_DA_PLUGGY,
    Regra,
    categoria_do_mobills,
    chave_do_destinatario,
    decidir,
    traduzir_da_pluggy,
)
from finance_api.main import app
from finance_api.mobills import LinhaDoMobills, MovimentoParaCasar, casar, importar, ler_csv
from finance_api.repositorio import classificar_movimentos
from ingestion_worker.extrato import processar_movimentos
from mercurio_domain import Proveniencia

client = TestClient(app, headers={"Authorization": f"Bearer {config.FINANCE_API_TOKEN}"})

TIPOS = {
    "viagem": "despesa",
    "alimentacao": "despesa",
    "supermercado": "despesa",
    "pix-para-pessoas": "despesa",
    "salario-e-extras": "receita",
    "rendimentos": "receita",
    "vendas": "receita",
}

PIX_PARA_ANA = "Transferência enviada|Ana Exemplo"
PIX_PARA_BRUNO = "Transferência enviada|Bruno Exemplo"
# A fila conta os ciclos a partir de hoje; fixar o dia deixa o teste estável.
HOJE = "2026-10-15"


def _movimento(
    identificador: str,
    data: str,
    valor: float,
    descricao: str,
    categoria_id: str | None = "05070000",
    tipo: str = "despesa",
) -> dict:
    return {
        "data": data,
        "valor": valor,
        "descricao": descricao,
        "conta_id": "corrente",
        "tipo": tipo,
        "identificador_externo": identificador,
        "categoria_id": categoria_id,
    }


@pytest.fixture
def gravar(semear_contas, semear_movimentos, sessao_de_teste_factory):
    """Grava os movimentos e classifica, como a sincronização faz."""
    semear_contas([{"id": "corrente", "nome": "Conta fictícia", "tipo": "BANK", "saldo": 1000}])

    def _gravar(*movimentos: dict) -> None:
        semear_movimentos(
            processar_movimentos(pd.DataFrame(list(movimentos))), Proveniencia.PLUGGY.value
        )

        async def classificar() -> None:
            async with sessao_de_teste_factory() as sessao:
                await classificar_movimentos(sessao)

        asyncio.run(classificar())

    return _gravar


def _por_descricao_e_data() -> dict[tuple[str, str], dict]:
    return {(m["descricao"], m["data"]): m for m in client.get("/movimentos").json()}


def _corrigir(movimento_id: int, categoria: str, *, todos: bool = False):
    return client.patch(
        f"/movimentos/{movimento_id}/categoria",
        json={"categoria": categoria, "todos_do_destinatario": todos},
    )


def test_ordem_de_decisao_correcao_vence_regra_que_vence_pluggy() -> None:
    regra = Regra("viagem")
    assert decidir(tipo="despesa", fatura=False, regra=regra, categoria_id_da_pluggy="11010000", tipos_das_categorias=TIPOS) == (
        "viagem",
        "regra",
    )
    assert decidir(tipo="despesa", fatura=False, regra=None, categoria_id_da_pluggy="11010000", tipos_das_categorias=TIPOS) == (
        "alimentacao",
        "pluggy",
    )
    assert decidir(tipo="despesa", fatura=False, regra=None, categoria_id_da_pluggy="05070000", tipos_das_categorias=TIPOS) == (
        None,
        None,
    )


def test_destinatario_misto_fica_para_classificar_mesmo_com_categoria_da_pluggy() -> None:
    assert decidir(
        tipo="despesa", fatura=False, regra=Regra(None), categoria_id_da_pluggy="11010000", tipos_das_categorias=TIPOS) == (None, None)


def test_transferencia_propria_e_fatura_nao_levam_categoria() -> None:
    assert decidir(
        tipo="retirada_titular", fatura=False, regra=None, categoria_id_da_pluggy="10000000", tipos_das_categorias=TIPOS) == (None, None)
    assert decidir(tipo="despesa", fatura=True, regra=None, categoria_id_da_pluggy="10000000", tipos_das_categorias=TIPOS) == (
        None,
        None,
    )


def test_traducao_usa_o_prefixo_mais_longo() -> None:
    assert traduzir_da_pluggy("18020000") == "farmacia"
    assert traduzir_da_pluggy("18040000") == "saude"
    assert traduzir_da_pluggy("12020000") == "hospedagem"
    assert traduzir_da_pluggy("12010000") == "viagem"
    assert traduzir_da_pluggy("03060000") == "rendimentos"
    assert traduzir_da_pluggy("03020000") is None
    assert traduzir_da_pluggy(None) is None


def test_chave_do_destinatario_e_o_nome_depois_da_barra() -> None:
    assert chave_do_destinatario(PIX_PARA_ANA) == "ana exemplo"
    assert chave_do_destinatario("  Mercado Exemplo ") == "mercado exemplo"


def test_mobills_ignora_acento_e_caixa() -> None:
    assert categoria_do_mobills("Reserva de Emergência") == "investimento-e-reserva"
    assert categoria_do_mobills("SALÁRIO") == "salario-e-extras"
    assert categoria_do_mobills("Categoria nova") is None


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_toda_categoria_usada_no_codigo_existe_na_tabela() -> None:
    """As traduções apontam para ids da tabela criada pela migração. Um id
    errado aqui quebraria a chave estrangeira só na sincronização."""
    existentes = {categoria["id"] for categoria in client.get("/categorias").json()}

    assert existentes == set(CATEGORIAS_DAS_MIGRACOES)
    tipos = [categoria["tipo"] for categoria in client.get("/categorias").json()]
    assert (tipos.count("despesa"), tipos.count("receita")) == (19, 5)
    assert set(TRADUCAO_DA_PLUGGY.values()) <= existentes
    assert set(DO_MOBILLS.values()) <= existentes


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_sincronizacao_traduz_a_pluggy_e_deixa_o_pix_para_classificar(gravar) -> None:
    gravar(
        _movimento("T1", "2026-10-01", 80.0, "Mercado Exemplo", "10000000"),
        _movimento("T2", "2026-10-02", 50.0, PIX_PARA_ANA),
    )

    movimentos = _por_descricao_e_data()
    assert movimentos[("Mercado Exemplo", "2026-10-01")]["categoria_propria"] == "supermercado"
    assert movimentos[("Mercado Exemplo", "2026-10-01")]["origem_da_categoria"] == "pluggy"
    assert movimentos[(PIX_PARA_ANA, "2026-10-02")]["categoria_propria"] is None
    assert client.get("/movimentos/para-classificar", params={"hoje": HOJE}).json() == {"total": 1}


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_fila_para_classificar_cobre_so_os_seis_ciclos_recentes(gravar) -> None:
    """Contados a partir de `HOJE`, o ciclo atual e os cinco anteriores
    começam no dia do segundo movimento; o da véspera fica fora da fila e
    do aviso."""
    gravar(
        _movimento("T1", "2026-08-04", 50.0, PIX_PARA_ANA),
        _movimento("T2", "2026-08-05", 60.0, PIX_PARA_ANA),
    )

    fila = client.get("/movimentos", params={"para_classificar": True, "hoje": HOJE}).json()

    assert [movimento["data"] for movimento in fila] == ["2026-08-05"]
    assert client.get("/movimentos/para-classificar", params={"hoje": HOJE}).json() == {"total": 1}


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_corrigir_todos_do_destinatario_cria_regra_e_muda_os_antigos_automaticos(gravar) -> None:
    gravar(
        _movimento("T1", "2026-10-01", 50.0, PIX_PARA_ANA),
        _movimento("T2", "2026-10-02", 60.0, PIX_PARA_ANA),
        _movimento("T3", "2026-10-03", 70.0, PIX_PARA_ANA),
    )
    movimentos = _por_descricao_e_data()
    escolhido_a_mao = movimentos[(PIX_PARA_ANA, "2026-10-03")]["id"]
    assert _corrigir(escolhido_a_mao, "presentes-e-doacoes").status_code == 200

    resposta = _corrigir(movimentos[(PIX_PARA_ANA, "2026-10-01")]["id"], "alimentacao", todos=True)
    assert resposta.status_code == 200
    gravar(_movimento("T4", "2026-10-09", 40.0, PIX_PARA_ANA))

    depois = _por_descricao_e_data()
    assert depois[(PIX_PARA_ANA, "2026-10-01")]["origem_da_categoria"] == "dono"
    assert depois[(PIX_PARA_ANA, "2026-10-02")]["categoria_propria"] == "alimentacao"
    assert depois[(PIX_PARA_ANA, "2026-10-02")]["origem_da_categoria"] == "regra"
    assert depois[(PIX_PARA_ANA, "2026-10-09")]["categoria_propria"] == "alimentacao"
    # O que o dono escolheu antes não muda com a regra nova.
    assert depois[(PIX_PARA_ANA, "2026-10-03")]["categoria_propria"] == "presentes-e-doacoes"


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_corrigir_so_este_contra_a_regra_torna_o_destinatario_misto(gravar) -> None:
    gravar(
        _movimento("T1", "2026-10-01", 50.0, PIX_PARA_ANA),
        _movimento("T2", "2026-10-02", 60.0, PIX_PARA_ANA),
    )
    movimentos = _por_descricao_e_data()
    _corrigir(movimentos[(PIX_PARA_ANA, "2026-10-01")]["id"], "alimentacao", todos=True)

    resposta = _corrigir(movimentos[(PIX_PARA_ANA, "2026-10-02")]["id"], "viagem")
    gravar(_movimento("T3", "2026-10-09", 40.0, PIX_PARA_ANA, "11010000"))

    assert resposta.json()["categoria_propria"] == "viagem"
    novo = _por_descricao_e_data()[(PIX_PARA_ANA, "2026-10-09")]
    assert novo["categoria_propria"] is None
    fila = client.get("/movimentos", params={"para_classificar": True, "hoje": HOJE}).json()
    assert [m["data"] for m in fila] == ["2026-10-09"]
    assert {(h["categoria"], h["vezes"]) for h in fila[0]["historico"]} == {
        ("alimentacao", 1),
        ("viagem", 1),
    }


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_categoria_desconhecida_e_transferencia_propria_sao_recusadas(gravar) -> None:
    gravar(
        _movimento("T1", "2026-10-01", 50.0, PIX_PARA_ANA),
        _movimento("T2", "2026-10-02", 90.0, "Para a outra conta", "04000000", "retirada_titular"),
    )
    movimentos = _por_descricao_e_data()

    assert _corrigir(movimentos[(PIX_PARA_ANA, "2026-10-01")]["id"], "cripto").status_code == 422
    assert _corrigir(movimentos[("Para a outra conta", "2026-10-02")]["id"], "outros").status_code == 422
    assert _corrigir(999999, "outros").status_code == 404


def test_casamento_respeita_valor_sentido_e_um_dia_de_folga() -> None:
    movimentos = [
        MovimentoParaCasar(1, date(2026, 8, 3), Decimal("50.00"), "despesa", PIX_PARA_ANA),
        MovimentoParaCasar(2, date(2026, 8, 3), Decimal("50.00"), "receita", PIX_PARA_BRUNO),
        MovimentoParaCasar(3, date(2026, 8, 9), Decimal("12.30"), "despesa", "Padaria"),
    ]
    linhas = [
        LinhaDoMobills(date(2026, 8, 2), Decimal(-50), "Alimentação"),
        LinhaDoMobills(date(2026, 8, 4), Decimal(50), "Salário"),
        LinhaDoMobills(date(2026, 8, 11), Decimal("-12.3"), "Alimentação"),
    ]

    pares = casar(linhas, movimentos)

    assert [(linha.categoria, movimento.id) for linha, movimento in pares] == [
        ("Alimentação", 1),
        ("Salário", 2),
    ]


CSV_DO_MOBILLS = (
    '"Data";"Descricao";"Valor";"Conta";"Categoria";"Subcategoria";"Tags"\n'
    '"01/08/2026";"Almoço";"-50,00";"Conta";"Alimentação";"";""\n'
    '"02/08/2026";"Viagem";"-60,00";"Conta";"Viagem";"";""\n'
    '"03/08/2026";"Almoço";"-70,00";"Conta";"Alimentação";"";""\n'
    '"05/08/2026";"Mercado";"-80,00";"Conta";"Supermercado";"";""\n'
    '"06/08/2026";"Sem par";"-999,00";"Conta";"Outros";"";""\n'
)


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_importar_mobills_grava_categoria_e_regras_e_repetir_nao_muda_nada(
    gravar, sessao_de_teste_factory, tmp_path: Path
) -> None:
    gravar(
        _movimento("T1", "2026-08-01", 50.0, PIX_PARA_ANA),
        _movimento("T2", "2026-08-02", 60.0, PIX_PARA_ANA),
        _movimento("T3", "2026-08-03", 70.0, PIX_PARA_BRUNO),
        _movimento("T4", "2026-08-05", 80.0, "Mercado Exemplo", "08000000"),
    )
    arquivo = tmp_path / "mobills.csv"
    arquivo.write_bytes(CSV_DO_MOBILLS.encode("utf-16"))

    async def rodar() -> dict[str, int]:
        async with sessao_de_teste_factory() as sessao:
            return await importar(sessao, ler_csv(arquivo))

    primeira = asyncio.run(rodar())
    antes = _por_descricao_e_data()
    segunda = asyncio.run(rodar())

    assert primeira == segunda == {
        "linhas": 5,
        "categoria_desconhecida": 0,
        "casadas": 4,
        "regras": 2,
        "destinatarios_mistos": 1,
    }
    assert _por_descricao_e_data() == antes
    assert antes[("Mercado Exemplo", "2026-08-05")]["categoria_propria"] == "supermercado"
    assert antes[("Mercado Exemplo", "2026-08-05")]["origem_da_categoria"] == "mobills"

    # Ana recebeu por alimentação e viagem: o próximo Pix dela é perguntado.
    # Bruno só por alimentação: o próximo já chega classificado.
    gravar(
        _movimento("T5", "2026-09-01", 30.0, PIX_PARA_ANA),
        _movimento("T6", "2026-09-02", 30.0, PIX_PARA_BRUNO),
    )
    depois = _por_descricao_e_data()
    assert depois[(PIX_PARA_ANA, "2026-09-01")]["categoria_propria"] is None
    assert depois[(PIX_PARA_BRUNO, "2026-09-02")]["categoria_propria"] == "alimentacao"


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_importar_mobills_nao_desfaz_a_correcao_do_dono(
    gravar, sessao_de_teste_factory, tmp_path: Path
) -> None:
    gravar(_movimento("T4", "2026-08-05", 80.0, "Mercado Exemplo", "08000000"))
    movimento = _por_descricao_e_data()[("Mercado Exemplo", "2026-08-05")]
    _corrigir(movimento["id"], "casa", todos=True)
    arquivo = tmp_path / "mobills.csv"
    arquivo.write_bytes(CSV_DO_MOBILLS.encode("utf-16"))

    async def rodar() -> None:
        async with sessao_de_teste_factory() as sessao:
            await importar(sessao, ler_csv(arquivo))

    asyncio.run(rodar())
    gravar(_movimento("T9", "2026-09-05", 20.0, "Mercado Exemplo", "08000000"))

    depois = _por_descricao_e_data()
    assert depois[("Mercado Exemplo", "2026-08-05")]["categoria_propria"] == "casa"
    assert depois[("Mercado Exemplo", "2026-09-05")]["categoria_propria"] == "casa"


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_criar_categoria_entra_no_fim_da_lista_e_pode_ser_usada(gravar) -> None:
    gravar(_movimento("T1", "2026-10-01", 120.0, "Pet Shop Exemplo", "08030000"))

    resposta = client.post("/categorias", json={"nome": " Pet ", "icone": "Dog", "cor": 75})
    repetida = client.post("/categorias", json={"nome": "pet", "icone": "Dog", "cor": 75})
    movimento = _por_descricao_e_data()[("Pet Shop Exemplo", "2026-10-01")]

    assert resposta.status_code == 201
    assert resposta.json() == {"id": "pet", "nome": "Pet", "icone": "Dog", "cor": 75, "tipo": "despesa"}
    assert repetida.status_code == 422
    assert client.get("/categorias").json()[-1]["id"] == "pet"
    assert _corrigir(movimento["id"], "pet").json()["categoria_propria"] == "pet"


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_icone_e_cor_fora_do_formato_sao_recusados() -> None:
    assert client.post("/categorias", json={"nome": "X", "icone": "<svg>", "cor": 10}).status_code == 422
    assert client.post("/categorias", json={"nome": "X", "icone": "Dog", "cor": 360}).status_code == 422


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_tag_soma_so_as_despesas_marcadas_e_divide_por_categoria(gravar) -> None:
    gravar(
        _movimento("T1", "2026-10-02", 1450.0, "Pousada Exemplo", "12020000"),
        _movimento("T2", "2026-10-03", 186.4, "Restaurante Exemplo", "11010000"),
        _movimento("T3", "2026-10-04", 50.0, PIX_PARA_ANA, tipo="receita"),
        _movimento("T4", "2026-10-05", 80.0, "Mercado Exemplo", "10000000"),
    )
    movimentos = _por_descricao_e_data()
    ids = [
        movimentos[("Pousada Exemplo", "2026-10-02")]["id"],
        movimentos[("Restaurante Exemplo", "2026-10-03")]["id"],
        movimentos[(PIX_PARA_ANA, "2026-10-04")]["id"],
    ]

    lote = client.post("/movimentos/lote", json={"ids": ids, "tag": "viagem Exemplo"})
    client.put(f"/movimentos/{ids[0]}/tags", json={"tags": ["Viagem exemplo", "hospedagem"]})
    [viagem] = [tag for tag in client.get("/tags").json() if tag["nome"] == "viagem Exemplo"]
    resumo = client.get(f"/tags/{viagem['id']}").json()

    assert lote.json() == {"alterados": 3}
    assert viagem["gasto"] == "1636.40"
    assert viagem["quantidade"] == 3
    assert (viagem["primeira_data"], viagem["ultima_data"]) == ("2026-10-02", "2026-10-04")
    assert [(item["categoria"], item["total"]) for item in resumo["por_categoria"]] == [
        ("hospedagem", "1450.00"),
        ("alimentacao", "186.40"),
    ]
    assert _por_descricao_e_data()[("Pousada Exemplo", "2026-10-02")]["tags"] == [
        "hospedagem",
        "viagem Exemplo",
    ]
    filtrados = client.get("/movimentos", params={"tag_id": viagem["id"]}).json()
    assert len(filtrados) == 3


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_tag_nao_muda_o_gasto_por_dia(gravar) -> None:
    gravar(_movimento("T1", "2026-10-02", 1450.0, "Pousada Exemplo", "12020000"))
    params = {"data_inicio": "2026-10-01", "data_fim": "2026-10-31"}
    antes = client.get("/movimentos/gastos-diarios", params=params).json()

    [movimento] = client.get("/movimentos").json()
    client.put(f"/movimentos/{movimento['id']}/tags", json={"tags": ["viagem Exemplo"]})

    assert client.get("/movimentos/gastos-diarios", params=params).json() == antes


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_categoria_em_lote_vale_so_para_os_marcados_e_pula_transferencia(gravar) -> None:
    gravar(
        _movimento("T1", "2026-10-01", 50.0, PIX_PARA_ANA),
        _movimento("T2", "2026-10-02", 60.0, PIX_PARA_ANA),
        _movimento("T3", "2026-10-03", 90.0, "Para a outra conta", "04000000", "retirada_titular"),
    )
    movimentos = _por_descricao_e_data()
    marcados = [
        movimentos[(PIX_PARA_ANA, "2026-10-01")]["id"],
        movimentos[("Para a outra conta", "2026-10-03")]["id"],
    ]

    client.post("/movimentos/lote", json={"ids": marcados, "categoria": "viagem"})
    gravar(_movimento("T4", "2026-10-09", 40.0, PIX_PARA_ANA))

    depois = _por_descricao_e_data()
    assert depois[(PIX_PARA_ANA, "2026-10-01")]["categoria_propria"] == "viagem"
    assert depois[(PIX_PARA_ANA, "2026-10-02")]["categoria_propria"] is None
    assert depois[(PIX_PARA_ANA, "2026-10-09")]["categoria_propria"] is None
    assert depois[("Para a outra conta", "2026-10-03")]["categoria_propria"] is None
    assert client.post("/movimentos/lote", json={"ids": marcados}).status_code == 422


# Receita e reembolso. Ver docs/specs/2026-11-13-categorias-de-receita-e-reembolso.md.


def test_categoria_automatica_tem_o_tipo_do_movimento() -> None:
    """Regra de destinatário vem dos Pix enviados a ele; aplicada ao Pix que
    ele devolve, viraria reembolso sem o dono escolher."""
    assert decidir(
        tipo="receita", fatura=False, regra=Regra("pix-para-pessoas"), categoria_id_da_pluggy=None, tipos_das_categorias=TIPOS
    ) == (None, None)
    assert decidir(
        tipo="receita", fatura=False, regra=Regra("salario-e-extras"), categoria_id_da_pluggy=None, tipos_das_categorias=TIPOS
    ) == ("salario-e-extras", "regra")
    assert decidir(
        tipo="despesa", fatura=False, regra=Regra("vendas"), categoria_id_da_pluggy=None, tipos_das_categorias=TIPOS
    ) == (None, None)
    assert decidir(
        tipo="receita", fatura=False, regra=None, categoria_id_da_pluggy="03060000", tipos_das_categorias=TIPOS
    ) == ("rendimentos", "pluggy")
    # A regra do destinatário é de despesa: não vale para a receita, e a
    # decisão segue para a Pluggy em vez de parar.
    assert decidir(
        tipo="receita",
        fatura=False,
        regra=Regra("pix-para-pessoas"),
        categoria_id_da_pluggy="03060000",
        tipos_das_categorias=TIPOS,
    ) == ("rendimentos", "pluggy")
    assert decidir(
        tipo="receita", fatura=False, regra=None, categoria_id_da_pluggy="11010000", tipos_das_categorias=TIPOS
    ) == (None, None)


RECEBIDO_DE_ANA = "Transferência recebida|Ana Exemplo"
RECEBIDO_DE_BRUNO = "Transferência recebida|Bruno Exemplo"


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_reembolso_abate_a_categoria_e_o_dia_em_que_chega(gravar, sessao_de_teste_factory) -> None:
    """À mão: farmácia de 180 no dia 05 por três pessoas; Ana devolve 60 no
    dia 05 e Bruno 60 no dia 06, quando houve mercado de 40. Gasto do dia 05:
    180 - 60 = 120; do dia 06: 40 - 60 = -20. Farmácia: 60. Entradas do ciclo
    sem os 120 devolvidos."""
    from finance_api.ciclo import ciclo_de
    from finance_api.repositorio import gasto_por_categoria_no_periodo, totais_dos_ciclos

    gravar(
        _movimento("F1", "2026-10-05", 180.0, "Drogaria Exemplo", "18020000"),
        _movimento("R1", "2026-10-05", 60.0, RECEBIDO_DE_ANA, "05070000", tipo="receita"),
        _movimento("R2", "2026-10-06", 60.0, RECEBIDO_DE_BRUNO, "05070000", tipo="receita"),
        _movimento("M1", "2026-10-06", 40.0, "Mercado Exemplo", "10000000"),
        _movimento("S1", "2026-10-06", 1000.0, "Salário Exemplo", "01000000", tipo="receita"),
    )
    movimentos = _por_descricao_e_data()
    for chave in [(RECEBIDO_DE_ANA, "2026-10-05"), (RECEBIDO_DE_BRUNO, "2026-10-06")]:
        assert _corrigir(movimentos[chave]["id"], "farmacia").status_code == 200

    dias = client.get("/movimentos/gastos-diarios", params={"data_inicio": "2026-10-05", "data_fim": "2026-10-06"}).json()
    assert {dia["data"]: dia["total"] for dia in dias} == {"2026-10-05": "120.00", "2026-10-06": "-20.00"}

    async def somas():
        async with sessao_de_teste_factory() as sessao:
            categorias = await gasto_por_categoria_no_periodo(
                sessao, inicio=date(2026, 10, 5), fim=date(2026, 10, 6)
            )
            ciclo = ciclo_de(date(2026, 10, 5))
            return categorias, (await totais_dos_ciclos(sessao, [ciclo]))[ciclo]

    categorias, totais = asyncio.run(somas())
    assert categorias == {"farmacia": Decimal("60.00"), "supermercado": Decimal("40.00")}
    assert (totais.gasto, totais.entrou) == (Decimal("100.00"), Decimal("1000.00"))


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_reembolso_nao_vira_regra_nem_deixa_a_do_destinatario_mista(gravar) -> None:
    """Ana recebe Pix por "Pix para pessoas", regra do dono. O Pix que ela
    devolveu marcado como Farmácia, mesmo pedindo "todos", não muda a regra:
    o próximo Pix para ela continua em "Pix para pessoas"."""
    gravar(
        _movimento("P1", "2026-10-01", 50.0, PIX_PARA_ANA),
        _movimento("R1", "2026-10-02", 30.0, RECEBIDO_DE_ANA, tipo="receita"),
    )
    movimentos = _por_descricao_e_data()
    assert _corrigir(movimentos[(PIX_PARA_ANA, "2026-10-01")]["id"], "pix-para-pessoas", todos=True).status_code == 200
    assert _corrigir(movimentos[(RECEBIDO_DE_ANA, "2026-10-02")]["id"], "farmacia", todos=True).status_code == 200

    gravar(_movimento("P2", "2026-10-10", 70.0, PIX_PARA_ANA))
    depois = _por_descricao_e_data()

    assert depois[(PIX_PARA_ANA, "2026-10-10")]["categoria_propria"] == "pix-para-pessoas"
    assert depois[(RECEBIDO_DE_ANA, "2026-10-02")]["categoria_propria"] == "farmacia"


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_despesa_nao_aceita_categoria_de_entrada(gravar) -> None:
    gravar(_movimento("P1", "2026-10-01", 50.0, "Loja Exemplo", "08000000"))
    movimento = _por_descricao_e_data()[("Loja Exemplo", "2026-10-01")]

    assert _corrigir(movimento["id"], "vendas").status_code == 422


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_categoria_de_entrada_criada_pelo_dono() -> None:
    resposta = client.post("/categorias", json={"nome": "Aluguel recebido", "icone": "House", "cor": 40, "tipo": "receita"})

    assert resposta.status_code == 201
    assert resposta.json()["tipo"] == "receita"


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_legacy_received_pix_migration_preserves_other_choices(gravar, sessao_de_teste_factory) -> None:
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    gravar(
        _movimento("L1", "2026-10-05", 40, "Entrada saude exemplo", tipo="receita"),
        _movimento("L2", "2026-10-05", 50, "Entrada pix exemplo", tipo="receita"),
        _movimento("L3", "2026-10-05", 60, "Devolucao farmacia exemplo", tipo="receita"),
        _movimento("L4", "2026-10-05", 25, "Consulta exemplo"),
    )
    expected_categories = {
        "Entrada saude exemplo": "saude", "Entrada pix exemplo": "pix-para-pessoas",
        "Devolucao farmacia exemplo": "farmacia", "Consulta exemplo": "saude",
    }
    for (description, _), movement in _por_descricao_e_data().items():
        assert _corrigir(movement["id"], expected_categories[description]).status_code == 200
    before = _por_descricao_e_data()
    migration = runpy.run_path(str(
        Path(__file__).parents[1] / "alembic/versions/d9e4c6a1b732_reset_legacy_received_pix.py"
    ))

    async def apply(direction):
        async with sessao_de_teste_factory() as session:
            connection = await session.connection()

            def execute(sync_connection):
                with Operations.context(MigrationContext.configure(sync_connection)):
                    migration[direction]()

            await connection.run_sync(execute)
            await session.commit()

    asyncio.run(apply("upgrade"))
    after = _por_descricao_e_data()
    for key, movement in after.items():
        assert movement["valor"] == before[key]["valor"]
        if key[0].startswith("Entrada"):
            assert movement["categoria_propria"] is None
            assert movement["origem_da_categoria"] is None
        else:
            assert movement["categoria_propria"] == expected_categories[key[0]]
            assert movement["origem_da_categoria"] == "dono"
    asyncio.run(apply("upgrade"))
    assert _por_descricao_e_data() == after
    asyncio.run(apply("downgrade"))
    assert _por_descricao_e_data() == after


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_refund_in_the_next_cycle_preserves_the_purchase_cycle(gravar, sessao_de_teste_factory) -> None:
    from finance_api.ciclo import ciclo_de
    from finance_api.repositorio import medias_do_dia_a_dia, totais_dos_ciclos

    gravar(
        _movimento("C1", "2026-10-14", 180, "Farmacia exemplo", "18020000"),
        _movimento("C2", "2026-10-15", 60, "Pix de volta exemplo", tipo="receita"),
    )
    movements = _por_descricao_e_data()
    ids = [movement["id"] for movement in movements.values()]
    refund = movements[("Pix de volta exemplo", "2026-10-15")]
    assert _corrigir(refund["id"], "farmacia").status_code == 200
    assert client.post("/movimentos/lote", json={"ids": ids, "tag": "Compra compartilhada"}).status_code == 200
    tag = client.get("/tags").json()[0]
    assert tag["gasto"] == "120.00"

    async def totals():
        async with sessao_de_teste_factory() as session:
            cycles = [ciclo_de(date(2026, 10, 14)), ciclo_de(date(2026, 10, 15))]
            return await totais_dos_ciclos(session, cycles), await medias_do_dia_a_dia(session, cycles)

    cycle_totals, averages = asyncio.run(totals())
    previous = cycle_totals[ciclo_de(date(2026, 10, 14))]
    following = cycle_totals[ciclo_de(date(2026, 10, 15))]
    assert (previous.gasto, following.gasto, following.entrou) == (Decimal(180), Decimal(-60), Decimal(0))
    assert averages == [Decimal(-60) / Decimal(21)]
    free = client.get("/dinheiro-livre", params={"hoje": "2026-10-15"}).json()
    assert free["gasto_hoje"] == "-60.00"
    assert free["saldo_contas"] == "1000.00"


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_api_explains_suspended_savings_after_negative_refund_history(gravar) -> None:
    gravar(
        _movimento("H1", "2026-06-01", 1, "Compra inicial exemplo", "08000000"),
        _movimento("H2", "2026-06-20", 300, "Devolucao junho exemplo", tipo="receita"),
        _movimento("H3", "2026-07-20", 300, "Devolucao julho exemplo", tipo="receita"),
    )
    for (description, _), movement in _por_descricao_e_data().items():
        if description.startswith("Devolucao"):
            assert _corrigir(movement["id"], "farmacia").status_code == 200

    response = client.get("/dinheiro-livre", params={"hoje": "2026-08-10"})

    assert response.status_code == 200
    body = response.json()
    assert body["da_para_guardar"] is None
    assert body["savings_suggestion_reason"] == "negative_estimate"
