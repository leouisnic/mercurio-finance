"""Tags com teto, período e análise. Todo dado aqui é fictício."""

import asyncio
from datetime import date
from decimal import Decimal

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from finance_api.ciclo import ciclo_anterior, ciclo_de, ciclo_seguinte
from finance_api.main import app
from finance_api.repositorio import classificar_movimentos
from finance_api.tags import GastoDaTag, TotaisDoCiclo, analisar, ciclos_do_impacto
from ingestion_worker.extrato import processar_movimentos
from mercurio_domain import Proveniencia

client = TestClient(app)
D = Decimal


def test_impacto_compara_com_a_media_dos_tres_ciclos_anteriores() -> None:
    """Conta à mão: típico (3.000 + 3.200 + 2.800) / 3 = 3.000; o ciclo da
    viagem gastou 5.400, rombo de 2.400; sobra média (4.000 - 3.000 + 4.000
    - 3.200 + 4.000 - 2.800) / 3 = 1.000; recupera em 3 ciclos."""
    viagem = ciclo_de(date(2026, 10, 6))
    c1 = ciclo_anterior(viagem)
    c2 = ciclo_anterior(c1)
    c3 = ciclo_anterior(c2)
    gastos = [
        GastoDaTag(viagem.inicio, D("1450.00"), "Pousada Exemplo", "viagem"),
        GastoDaTag(viagem.inicio, D("330.00"), "Posto Exemplo", "transporte"),
        GastoDaTag(date(2026, 10, 9), D("420.00"), "Passeio Exemplo", "lazer"),
    ]
    totais = {
        c3: TotaisDoCiclo(D("3000"), D("4000")),
        c2: TotaisDoCiclo(D("3200"), D("4000")),
        c1: TotaisDoCiclo(D("2800"), D("4000")),
        viagem: TotaisDoCiclo(D("5400"), D("4000")),
    }

    analise = analisar(gastos, totais=totais, hoje=date(2026, 10, 20))

    assert analise.total == D("2200.00")
    assert analise.dia_mais_caro == (viagem.inicio, D("1780.00"))
    assert analise.categoria_principal == ("viagem", D("1450.00"))
    assert [g.descricao for g in analise.maiores][:1] == ["Pousada Exemplo"]
    impacto = analise.impacto
    assert impacto is not None
    assert (impacto.tipico, impacto.rombo, impacto.sobra_media) == (D("3000.00"), D("2400.00"), D("1000.00"))
    # A tag gastou 2.200 no ciclo: só essa parte do rombo de 2.400 é dela.
    assert impacto.rombo_da_tag == D("2200.00")
    assert impacto.ciclos_para_recuperar == 3
    # O ciclo seguinte já começou mas não tem dado: fica fora do gráfico.
    assert [barra.ciclo for barra in impacto.barras] == [c3, c2, c1, viagem]
    assert impacto.barras[-1].gasto_da_tag == D("2200.00")


def test_sem_ciclo_anterior_com_dado_nao_ha_impacto() -> None:
    viagem = ciclo_de(date(2026, 10, 6))
    gastos = [GastoDaTag(date(2026, 10, 6), D("100.00"), "Pousada Exemplo", None)]

    analise = analisar(gastos, totais={viagem: TotaisDoCiclo(D("100"), D("0"))}, hoje=date(2026, 10, 20))

    assert analise.impacto is None
    assert analise.total == D("100.00")


def test_gasto_dentro_do_tipico_nao_tem_rombo_nem_recuperacao() -> None:
    viagem = ciclo_de(date(2026, 10, 6))
    anterior = ciclo_anterior(viagem)
    gastos = [GastoDaTag(date(2026, 10, 6), D("100.00"), "Pousada Exemplo", None)]
    totais = {anterior: TotaisDoCiclo(D("3000"), D("4000")), viagem: TotaisDoCiclo(D("2500"), D("4000"))}

    impacto = analisar(gastos, totais=totais, hoje=date(2026, 10, 20)).impacto

    assert impacto is not None
    assert (impacto.rombo, impacto.ciclos_para_recuperar) == (D("0"), None)


def test_ciclos_do_impacto_pega_o_ciclo_que_mais_gastou() -> None:
    outubro = ciclo_de(date(2026, 10, 6))
    gastos = [
        GastoDaTag(date(2026, 9, 20), D("50.00"), "Reserva Exemplo", None),
        GastoDaTag(date(2026, 10, 6), D("900.00"), "Pousada Exemplo", None),
    ]

    principal, todos = ciclos_do_impacto(gastos)

    assert principal == outubro
    assert todos[-1] == ciclo_seguinte(outubro)
    assert len(todos) == 5


@pytest.fixture
def gravar(semear_contas, semear_movimentos, sessao_de_teste_factory):
    """Grava e classifica, como a sincronização faz."""
    semear_contas([{"id": "corrente", "nome": "Conta fictícia", "tipo": "BANK", "saldo": 1000}])

    def _gravar(*linhas: tuple[str, str, float, str, str]) -> None:
        movimentos = [
            {
                "data": data,
                "valor": valor,
                "descricao": descricao,
                "conta_id": "corrente",
                "tipo": tipo,
                "identificador_externo": identificador,
                "categoria_id": "12000000",
            }
            for identificador, data, valor, descricao, tipo in linhas
        ]
        semear_movimentos(processar_movimentos(pd.DataFrame(movimentos)), Proveniencia.PLUGGY.value)

        async def classificar() -> None:
            async with sessao_de_teste_factory() as sessao:
                await classificar_movimentos(sessao)

        asyncio.run(classificar())

    return _gravar


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_criar_tag_com_teto_e_periodo_e_recusar_nome_repetido_ou_periodo_invertido() -> None:
    resposta = client.post(
        "/tags",
        json={"nome": " viagem Exemplo ", "icone": "Plane", "cor": 220, "teto": "6000.00", "inicio": "2026-12-10", "fim": "2026-12-17"},
    )

    assert resposta.status_code == 201
    criada = resposta.json()
    assert criada | {"id": 0} == {
        "id": 0,
        "nome": "viagem Exemplo",
        "icone": "Plane",
        "cor": 220,
        "teto": "6000.00",
        "inicio": "2026-12-10",
        "fim": "2026-12-17",
        "arquivada": False,
        "gasto": "0",
        "quantidade": 0,
        "primeira_data": None,
        "ultima_data": None,
    }
    assert client.post("/tags", json={"nome": "VIAGEM exemplo"}).status_code == 422
    assert client.post("/tags", json={"nome": "Outra", "inicio": "2026-12-17", "fim": "2026-12-10"}).status_code == 422


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_editar_arquivar_e_apagar_tag_mantem_os_movimentos(gravar) -> None:
    gravar(("T1", "2026-10-06", 1450.0, "Pousada Exemplo", "despesa"))
    [movimento] = client.get("/movimentos").json()
    client.put(f"/movimentos/{movimento['id']}/tags", json={"tags": ["viagem Exemplo"]})
    [tag] = client.get("/tags").json()

    editada = client.patch(f"/tags/{tag['id']}", json={"nome": "viagem Litoral", "arquivada": True, "teto": None})

    assert editada.status_code == 200
    assert editada.json()["nome"] == "viagem Litoral"
    assert editada.json()["arquivada"] is True
    assert editada.json()["gasto"] == "1450.00"
    assert client.delete(f"/tags/{tag['id']}").status_code == 204
    assert client.get("/tags").json() == []
    assert client.get("/movimentos").json()[0]["tags"] == []
    assert client.delete(f"/tags/{tag['id']}").status_code == 404


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_resumo_da_tag_traz_a_analise_e_o_impacto(gravar) -> None:
    viagem = ciclo_de(date(2026, 10, 6))
    anterior = ciclo_anterior(viagem)
    gravar(
        ("T1", anterior.inicio.isoformat(), 4000.0, "Salário Exemplo", "receita"),
        ("T2", anterior.inicio.isoformat(), 1000.0, "Mercado Exemplo", "despesa"),
        ("T3", viagem.inicio.isoformat(), 1450.0, "Pousada Exemplo", "despesa"),
        ("T4", viagem.inicio.isoformat(), 600.0, "Mercado Exemplo", "despesa"),
    )
    pousada = next(m for m in client.get("/movimentos").json() if m["descricao"] == "Pousada Exemplo")
    client.put(f"/movimentos/{pousada['id']}/tags", json={"tags": ["viagem Exemplo"]})
    [tag] = client.get("/tags").json()

    resumo = client.get(f"/tags/{tag['id']}", params={"hoje": "2026-10-20"}).json()

    assert resumo["maiores"][0]["descricao"] == "Pousada Exemplo"
    assert resumo["dia_mais_caro"] == {"data": viagem.inicio.isoformat(), "total": "1450.00"}
    assert resumo["categoria_principal"]["categoria"] == "viagem"
    impacto = resumo["impacto"]
    assert (impacto["tipico"], impacto["rombo"], impacto["sobra_media"]) == ("1000.00", "1050.00", "3000.00")
    assert impacto["rombo_da_tag"] == "1050.00"
    assert impacto["ciclos_para_recuperar"] == 1


@pytest.mark.usefixtures("banco_de_teste_limpo")
def test_gasto_por_dia_traz_os_maiores_do_dia(gravar) -> None:
    gravar(
        ("T1", "2026-10-06", 86.4, "Restaurante Exemplo", "despesa"),
        ("T2", "2026-10-06", 20.6, "Padaria Exemplo", "despesa"),
        ("T3", "2026-10-06", 45.0, "Posto Exemplo", "despesa"),
        ("T4", "2026-10-06", 5.0, "Bala Exemplo", "despesa"),
    )

    [dia] = client.get("/movimentos/gastos-diarios", params={"data_inicio": "2026-10-06", "data_fim": "2026-10-06"}).json()

    assert [item["descricao"] for item in dia["maiores"]] == ["Restaurante Exemplo", "Posto Exemplo", "Padaria Exemplo"]


def test_categoria_principal_sem_categoria_fica_vazia() -> None:
    analise = analisar([GastoDaTag(date(2026, 10, 6), D("10.00"), "X", None)], totais={}, hoje=date(2026, 10, 6))

    assert analise.categoria_principal is None
