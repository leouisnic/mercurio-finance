"""Categorias próprias: ordem de decisão, correção do dono, regra por
destinatário e importação do Mobills. Todo dado aqui é fictício."""

import asyncio
from datetime import date
from decimal import Decimal
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from finance_api.categorias import (
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

client = TestClient(app)

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
    assert decidir(tipo="despesa", fatura=False, regra=regra, categoria_id_da_pluggy="11010000") == (
        "viagem",
        "regra",
    )
    assert decidir(tipo="despesa", fatura=False, regra=None, categoria_id_da_pluggy="11010000") == (
        "alimentacao",
        "pluggy",
    )
    assert decidir(tipo="despesa", fatura=False, regra=None, categoria_id_da_pluggy="05070000") == (
        None,
        None,
    )


def test_destinatario_misto_fica_para_classificar_mesmo_com_categoria_da_pluggy() -> None:
    assert decidir(
        tipo="despesa", fatura=False, regra=Regra(None), categoria_id_da_pluggy="11010000"
    ) == (None, None)


def test_transferencia_propria_e_fatura_nao_levam_categoria() -> None:
    assert decidir(
        tipo="retirada_titular", fatura=False, regra=None, categoria_id_da_pluggy="10000000"
    ) == (None, None)
    assert decidir(tipo="despesa", fatura=True, regra=None, categoria_id_da_pluggy="10000000") == (
        None,
        None,
    )


def test_traducao_usa_o_prefixo_mais_longo() -> None:
    assert traduzir_da_pluggy("18020000") == "farmacia"
    assert traduzir_da_pluggy("18040000") == "saude"
    assert traduzir_da_pluggy("03060000") == "investimento-e-reserva"
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

    assert len(existentes) == 19
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
    assert resposta.json() == {"id": "pet", "nome": "Pet", "icone": "Dog", "cor": 75}
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
        ("viagem", "1450.00"),
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
