"""Feriado da cidade por pagador: muda só o pagamento de quem foi marcado.

Datas conferidas no calendário de 2026: 5 de janeiro é segunda, 2 de janeiro
sexta (o dia 1 é feriado nacional), 15 de janeiro quinta e 5 de janeiro de
2027 terça.
"""

from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient
from finance_api import config
from finance_api.ciclo import FeriadoLocal, definir_feriados_locais, dias_nao_uteis, p1, p2
from finance_api.main import app

client = TestClient(app, headers={"Authorization": f"Bearer {config.FINANCE_API_TOKEN}"})

# Dia de P1 e de P2 de cada mês, calculados com o calendário de antes desta
# leva, que só tinha os feriados nacionais.
PAGAMENTOS_SEM_FERIADO_LOCAL = {
    2026: "05/15 05/18 05/16 02/15 05/15 05/15 03/15 05/17 04/15 05/15 05/16 04/15",
    2027: "05/15 05/15 05/15 05/15 05/17 04/15 05/15 05/16 03/15 05/15 05/16 03/15",
}


@pytest.fixture
def sem_feriado_local() -> Iterator[None]:
    definir_feriados_locais(())
    yield
    definir_feriados_locais(())


def _feriado(data: date, pagadores: set[int], repete: bool = True) -> FeriadoLocal:
    return FeriadoLocal("Aniversário da Cidade A", data, repete, frozenset(pagadores))


def test_sem_feriado_local_os_pagamentos_nao_mudam(sem_feriado_local: None) -> None:
    for ano, esperado in PAGAMENTOS_SEM_FERIADO_LOCAL.items():
        calculado = " ".join(f"{p1(ano, mes).day:02d}/{p2(ano, mes).day:02d}" for mes in range(1, 13))
        assert calculado == esperado, ano


def test_feriado_marcado_para_quem_paga_o_ciclo_1_antecipa_so_o_p1(sem_feriado_local: None) -> None:
    definir_feriados_locais([_feriado(date(2026, 1, 5), {1})])
    assert p1(2026, 1) == date(2026, 1, 2)
    assert p2(2026, 1) == date(2026, 1, 15)


def test_feriado_de_outro_pagador_nao_mexe_no_p1(sem_feriado_local: None) -> None:
    definir_feriados_locais([_feriado(date(2026, 1, 5), {2}), _feriado(date(2026, 1, 5), set())])
    assert p1(2026, 1) == date(2026, 1, 5)


def test_feriado_marcado_para_quem_paga_o_ciclo_2_adia_o_p2(sem_feriado_local: None) -> None:
    definir_feriados_locais([_feriado(date(2026, 1, 15), {2})])
    assert p2(2026, 1) == date(2026, 1, 16)
    assert p1(2026, 1) == date(2026, 1, 5)


def test_feriado_que_repete_vale_nos_anos_seguintes_e_nao_nos_anteriores(sem_feriado_local: None) -> None:
    definir_feriados_locais([_feriado(date(2026, 1, 5), {1})])
    assert p1(2027, 1) == date(2027, 1, 4)
    assert p1(2025, 1) == date(2025, 1, 3)  # 5 de janeiro de 2025 foi domingo: igual ao nacional
    definir_feriados_locais([_feriado(date(2026, 1, 5), {1}, repete=False)])
    assert p1(2027, 1) == date(2027, 1, 5)


def test_dias_nao_uteis_tem_fim_de_semana_nacional_e_o_da_cidade(sem_feriado_local: None) -> None:
    definir_feriados_locais([_feriado(date(2026, 1, 6), set())])
    dias = dias_nao_uteis(date(2026, 1, 1), date(2026, 1, 6))

    assert dias == {
        date(2026, 1, 1): "Confraternização Universal",
        date(2026, 1, 3): None,
        date(2026, 1, 4): None,
        date(2026, 1, 6): "Aniversário da Cidade A",
    }


def test_cadastrar_feriado_pela_api_muda_o_ciclo_e_avisa_se_mexe_no_passado(
    banco_de_teste_limpo: None,
) -> None:
    resposta = client.post(
        "/feriados?hoje=2026-03-10",
        json={"nome": "Aniversário da Cidade A", "data": "2026-01-05", "muda_ciclo_1": True},
    )

    assert resposta.status_code == 201
    criado = resposta.json()
    assert criado["muda_ciclo_passado"] is True
    assert p1(2026, 1) == date(2026, 1, 2)
    assert client.get("/dias-nao-uteis?data_inicio=2026-01-05&data_fim=2026-01-05").json() == [
        {"data": "2026-01-05", "feriado": "Aniversário da Cidade A"}
    ]

    # Feriado que só marca não muda ciclo nenhum.
    so_marca = client.post(
        "/feriados?hoje=2026-03-10", json={"nome": "Feriado da Cidade B", "data": "2026-02-10"}
    )
    assert so_marca.json()["muda_ciclo_passado"] is False

    # Editar para só marcar desfaz a antecipação do P1 e avisa de novo.
    editado = client.put(
        f"/feriados/{criado['id']}?hoje=2026-03-10",
        json={"nome": "Aniversário da Cidade A", "data": "2026-01-05", "muda_ciclo_1": False},
    )
    assert editado.status_code == 200
    assert editado.json()["muda_ciclo_passado"] is True
    assert p1(2026, 1) == date(2026, 1, 5)
    assert client.put("/feriados/9999", json={"nome": "x", "data": "2026-01-05"}).status_code == 404

    assert client.delete(f"/feriados/{criado['id']}").status_code == 204
    assert p1(2026, 1) == date(2026, 1, 5)
    assert [feriado["nome"] for feriado in client.get("/feriados").json()] == ["Feriado da Cidade B"]
    assert client.delete(f"/feriados/{criado['id']}").status_code == 404
