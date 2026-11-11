"""Contadores do período e filtros da barra. Todo dado aqui é fictício."""

import asyncio
from datetime import date
from decimal import Decimal

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from finance_api import config
from finance_api.contadores import (
    calcular,
    categoria_que_mais_cresceu,
    dia_util_contra_nao_util,
    gasto_ate_o_dia,
)
from finance_api.main import app
from finance_api.models import CotaDoCicloORM
from finance_api.repositorio import classificar_movimentos, cota_guardada, guardar_cota
from ingestion_worker.extrato import processar_movimentos
from mercurio_domain import Proveniencia

client = TestClient(app, headers={"Authorization": f"Bearer {config.FINANCE_API_TOKEN}"})
D = Decimal

# Gastos de 28 de setembro a 6 de outubro: com gasto só em 28/9 e 2/10.
GASTOS = {date(2026, 9, 28): D("10"), date(2026, 10, 2): D("20")}


def test_conta_do_inicio_ate_hoje_e_olha_o_historico_na_sequencia() -> None:
    """De 1 a 6 de outubro são 6 dias, com gasto só no dia 2: 5 de ouro.
    Desde 28/9 são 9 dias, 7 sem gasto. A sequência atual vai de 3 a 6 (4
    dias) e é o recorde, maior que 29/9 a 1/10 (3 dias). Cota 15: só o dia 2
    passou."""
    contadores = calcular(
        GASTOS,
        inicio=date(2026, 10, 1),
        fim=date(2026, 10, 10),
        hoje=date(2026, 10, 6),
        primeiro_dia=date(2026, 9, 28),
        cota=D("15"),
    )

    assert contadores.dias == 6
    assert contadores.dias_de_ouro == 5
    assert contadores.dias_de_ouro_no_total == 7
    assert (contadores.sequencia, contadores.recorde) == (4, 4)
    assert (contadores.dentro_da_cota, contadores.acima_da_cota) == (5, 1)


def test_gasto_igual_a_cota_fica_dentro_e_sem_cota_nao_ha_contador() -> None:
    gastos = {**GASTOS, date(2026, 10, 2): D("15")}
    com_cota = calcular(
        gastos, inicio=date(2026, 10, 1), fim=date(2026, 10, 10), hoje=date(2026, 10, 6),
        primeiro_dia=date(2026, 9, 28), cota=D("15"),
    )
    sem_cota = calcular(
        gastos, inicio=date(2026, 10, 1), fim=date(2026, 10, 10), hoje=date(2026, 10, 6),
        primeiro_dia=date(2026, 9, 28),
    )

    assert (com_cota.dentro_da_cota, com_cota.acima_da_cota) == (6, 0)
    assert (sem_cota.dentro_da_cota, sem_cota.acima_da_cota) == (None, None)


def test_gasto_hoje_zera_a_sequencia_e_periodo_futuro_nao_tem_dia() -> None:
    gastos = {**GASTOS, date(2026, 10, 6): D("5")}
    hoje_com_gasto = calcular(
        gastos, inicio=date(2026, 10, 1), fim=date(2026, 10, 10), hoje=date(2026, 10, 6),
        primeiro_dia=date(2026, 9, 28),
    )
    futuro = calcular(
        gastos, inicio=date(2026, 11, 1), fim=date(2026, 11, 10), hoje=date(2026, 10, 6),
        primeiro_dia=date(2026, 9, 28),
    )

    assert (hoje_com_gasto.dias_de_ouro, hoje_com_gasto.sequencia, hoje_com_gasto.recorde) == (4, 0, 3)
    assert futuro.dias == 0
    assert futuro.dias_de_ouro == 0


def test_mesmo_ponto_do_ciclo_nao_passa_do_fim() -> None:
    gastos = {date(2026, 1, 1): D("10"), date(2026, 1, 2): D("20"), date(2026, 1, 3): D("40")}
    assert gasto_ate_o_dia(gastos, date(2026, 1, 1), 3, date(2026, 1, 2)) == D("30")
    assert gasto_ate_o_dia(gastos, date(2026, 1, 1), 2, date(2026, 1, 31)) == D("30")


@pytest.fixture
def gravar(semear_contas, semear_movimentos, sessao_de_teste_factory):
    semear_contas([{"id": "corrente", "nome": "Conta fictícia", "tipo": "BANK", "saldo": 1000}])

    def _gravar(*linhas: tuple[str, str, float]) -> None:
        movimentos = [
            {
                "data": data,
                "valor": valor,
                "descricao": f"Compra Exemplo {identificador}",
                "conta_id": "corrente",
                "tipo": "despesa",
                "identificador_externo": identificador,
                "categoria_id": "12000000",
            }
            for identificador, data, valor in linhas
        ]
        semear_movimentos(processar_movimentos(pd.DataFrame(movimentos)), Proveniencia.PLUGGY.value)

        # Grava e classifica, como a sincronização faz.
        async def classificar() -> None:
            async with sessao_de_teste_factory() as sessao:
                await classificar_movimentos(sessao)

        asyncio.run(classificar())

    return _gravar


def test_contadores_pela_api_com_cota_comparacao_e_sem_a_tag(banco_de_teste_limpo: None, gravar) -> None:
    """Ciclo 1 de 5 a 14 de outubro de 2026; o mesmo ciclo do mês anterior vai
    de 4 a 14 de setembro (5/9 é sábado). Hoje 7/10: 3 dias. Até o dia 3 do
    ciclo: 30 + 100 = 130 agora, 40 + 60 = 100 antes. Desde 4/9 são 34 dias, 4
    com gasto: 30 sem gasto; recorde de 6/9 a 4/10, 29 dias. Terça (6/10) é o
    dia mais caro, e nenhum dia do período é fim de semana ou feriado."""
    gravar(("a", "2026-09-04", 40), ("b", "2026-09-05", 60), ("c", "2026-10-05", 30), ("d", "2026-10-06", 100))
    ciclo = "data_inicio=2026-10-05&data_fim=2026-10-14&hoje=2026-10-07"

    resposta = client.get(f"/contadores?{ciclo}&cota=50").json()

    categoria = resposta.pop("categoria_que_cresceu")
    assert resposta == {
        "cota": "50",
        "ciclo_comparado": {"numero": 1, "inicio": "2026-09-04", "fim": "2026-09-14"},
        "dia_util": {"parte_nao_util": "0.0000", "dia_mais_caro": "terça", "media_do_dia_mais_caro": "100.00"},
        "dias": 3,
        "dias_de_ouro": 1,
        "dias_de_ouro_no_total": 30,
        "sequencia": 1,
        "recorde": 29,
        "dentro_da_cota": 2,
        "acima_da_cota": 1,
        "comparacao": {"gasto": "130.00", "gasto_anterior": "100.00"},
    }
    # A mesma categoria nos dois: 130 contra 100 nos três primeiros dias de cada ciclo.
    assert categoria["aumento"] == "30.00"

    [viagem] = client.get("/movimentos?data_inicio=2026-10-06&data_fim=2026-10-06").json()
    assert client.post("/movimentos/lote", json={"ids": [viagem["id"]], "tag": "viagem Exemplo"}).status_code == 200
    [tag] = client.get("/tags").json()

    sem_a_viagem = client.get(f"/contadores?{ciclo}&sem_tag_id={tag['id']}").json()
    assert (sem_a_viagem["dias_de_ouro"], sem_a_viagem["sequencia"]) == (2, 2)
    assert sem_a_viagem["comparacao"]["gasto"] == "30.00"

    so_a_viagem = client.get(f"/movimentos/gastos-diarios?data_inicio=2026-10-05&data_fim=2026-10-07&tag_id={tag['id']}")
    assert [(dia["data"], dia["total"]) for dia in so_a_viagem.json()] == [("2026-10-06", "100.00")]
    outra_conta = client.get("/movimentos/gastos-diarios?data_inicio=2026-10-05&data_fim=2026-10-07&conta_id=outra")
    assert outra_conta.json() == []


def test_ciclo_passado_usa_a_cota_guardada(banco_de_teste_limpo: None, gravar, sessao_de_teste_factory) -> None:
    """Sem cota na pergunta, o ciclo inteiro e sem filtro usa a guardada; com
    filtro, não há cota, porque ela vale para o gasto todo."""
    gravar(("a", "2026-10-05", 30), ("b", "2026-10-06", 100))

    async def guardar() -> None:
        async with sessao_de_teste_factory() as sessao:
            await guardar_cota(sessao, date(2026, 10, 5), D("50"), fim=date(2026, 10, 14))
            await guardar_cota(sessao, date(2026, 10, 5), D("45"), fim=date(2026, 10, 14))

    asyncio.run(guardar())
    ciclo = "data_inicio=2026-10-05&data_fim=2026-10-14&hoje=2026-10-20"

    guardada = client.get(f"/contadores?{ciclo}").json()
    filtrada = client.get(f"/contadores?{ciclo}&conta_id=corrente").json()

    # A última guardada vale: 45. De 5 a 14, só 6/10 (100) passou.
    assert guardada["cota"] == "45.00"
    assert (guardada["dentro_da_cota"], guardada["acima_da_cota"]) == (9, 1)
    assert filtrada["cota"] is None

    # O contrato também protege consultas diretas, sem depender da tela.
    negativa = client.get(f"/contadores?{ciclo}&cota=-10").json()
    zerada = client.get(f"/contadores?{ciclo}&cota=0").json()
    parcial = client.get("/contadores?data_inicio=2026-10-06&data_fim=2026-10-14&hoje=2026-10-20&cota=45").json()
    filtrada_com_cota = client.get(f"/contadores?{ciclo}&conta_id=corrente&cota=45").json()
    for sem_cota in (negativa, zerada, parcial, filtrada_com_cota):
        assert sem_cota["cota"] is None
        assert sem_cota["dentro_da_cota"] is None


def test_so_o_dia_real_guarda_cota(
    banco_de_teste_limpo: None, gravar, sessao_de_teste_factory, monkeypatch
) -> None:
    from finance_api import main

    class DataFixa(date):
        @classmethod
        def today(cls):
            return cls(2026, 10, 7)

    monkeypatch.setattr(main, "date", DataFixa)
    gravar(("a", "2026-10-05", 30))

    async def guardada(inicio: date, fim: date):
        async with sessao_de_teste_factory() as sessao:
            return await cota_guardada(sessao, inicio, fim)

    simulacao = client.get("/dinheiro-livre?hoje=2026-09-07")
    assert simulacao.status_code == 200
    assert asyncio.run(guardada(date(2026, 9, 4), date(2026, 9, 14))) is None

    atual = client.get("/dinheiro-livre?hoje=2026-10-07")
    assert atual.status_code == 200
    assert asyncio.run(guardada(date(2026, 10, 5), date(2026, 10, 14))) == D(atual.json()["cota_do_dia"])


def test_dia_util_contra_nao_util_e_categoria_que_cresceu() -> None:
    """Semana de 5 a 11 de outubro de 2026 (segunda a domingo), 12/10 feriado
    fora da semana: 300 no sábado e 100 na segunda de 400, 75% em dia não útil."""
    dias = [date(2026, 10, 5 + n) for n in range(7)]
    gastos = {date(2026, 10, 5): D("100"), date(2026, 10, 10): D("300")}
    nao_uteis = {date(2026, 10, 10), date(2026, 10, 11)}

    resultado = dia_util_contra_nao_util(gastos, dias, nao_uteis)

    assert resultado is not None
    assert resultado.parte_nao_util == D("0.75")
    assert (resultado.dia_mais_caro, resultado.media_do_dia_mais_caro) == ("sábado", D("300"))
    assert dia_util_contra_nao_util({}, dias, nao_uteis) is None
    assert categoria_que_mais_cresceu({"lazer": D("90"), "casa": D("10")}, {"lazer": D("20"), "casa": D("30")}) == (
        "lazer",
        D("70"),
    )
    assert categoria_que_mais_cresceu({"casa": D("10")}, {"casa": D("30")}) is None


def test_cota_legada_sem_intervalo_completo_fica_preservada_sem_reuso(
    banco_de_teste_limpo: None, gravar, sessao_de_teste_factory
) -> None:
    gravar(("a", "2026-10-05", 30))

    async def guardar_legada() -> None:
        async with sessao_de_teste_factory() as sessao:
            sessao.add(CotaDoCicloORM(inicio=date(2026, 10, 5), cota=D("50")))
            await sessao.commit()

    asyncio.run(guardar_legada())
    resposta = client.get(
        "/contadores?data_inicio=2026-10-05&data_fim=2026-10-14&hoje=2026-10-20"
    ).json()
    assert resposta["cota"] is None
    assert resposta["dentro_da_cota"] is None

    async def conferir_legada() -> None:
        async with sessao_de_teste_factory() as sessao:
            observacao = await sessao.get(CotaDoCicloORM, date(2026, 10, 5))
            assert observacao.cota == D("50")

    asyncio.run(conferir_legada())


def test_feriado_que_muda_o_fim_exige_observacao_do_novo_intervalo(
    banco_de_teste_limpo: None, gravar, sessao_de_teste_factory
) -> None:
    gravar(("a", "2027-01-05", 30))

    async def guardar(fim: date, cota: Decimal) -> None:
        async with sessao_de_teste_factory() as sessao:
            await guardar_cota(sessao, date(2027, 1, 5), cota, fim=fim)

    asyncio.run(guardar(date(2027, 1, 14), D("100")))
    parametros = {"data_inicio": "2027-01-05", "data_fim": "2027-01-14", "hoje": "2027-01-20"}
    assert client.get("/contadores", params=parametros).json()["cota"] == "100.00"
    feriado = client.post(
        "/feriados?hoje=2027-02-01",
        json={"nome": "Feriado Exemplo", "data": "2027-01-15", "repete_todo_ano": False, "muda_ciclo_2": True},
    )
    assert feriado.status_code == 201
    parametros["data_fim"] = "2027-01-17"
    sem_observacao = client.get("/contadores", params=parametros).json()
    assert sem_observacao["cota"] is None
    assert sem_observacao["dentro_da_cota"] is None

    asyncio.run(guardar(date(2027, 1, 17), D("70")))
    assert client.get("/contadores", params=parametros).json()["cota"] == "70.00"


def test_gasto_por_conta_respeita_categoria_tag_e_sua_exclusao(
    banco_de_teste_limpo: None, gravar
) -> None:
    gravar(("a", "2026-10-05", 30), ("b", "2026-10-06", 100))
    movimentos = {movimento["descricao"]: movimento for movimento in client.get("/movimentos").json()}
    primeiro = movimentos["Compra Exemplo a"]
    segundo = movimentos["Compra Exemplo b"]
    for movimento, categoria in ((primeiro, "supermercado"), (segundo, "saude")):
        assert client.patch(
            f"/movimentos/{movimento['id']}/categoria",
            json={"categoria": categoria, "todos_do_destinatario": False},
        ).status_code == 200
    assert client.post(
        "/movimentos/lote", json={"ids": [primeiro["id"]], "tag": "Casa Exemplo"}
    ).status_code == 200
    [tag] = client.get("/tags").json()

    for filtro, esperado in (
        ({}, D("130")),
        ({"categoria": "supermercado"}, D("30")),
        ({"tag_id": tag["id"]}, D("30")),
        ({"sem_tag_id": tag["id"]}, D("100")),
        ({"categoria": "supermercado", "sem_tag_id": tag["id"]}, D("0")),
    ):
        resposta = client.get(
            "/movimentos/por-conta",
            params={"data_inicio": "2026-10-05", "data_fim": "2026-10-14", **filtro},
        )
        assert resposta.status_code == 200
        assert sum((D(linha["saidas"]) for linha in resposta.json()), D("0")) == esperado
