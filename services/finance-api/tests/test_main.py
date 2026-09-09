from datetime import date

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from finance_api.compromissos import somar_meses
from finance_api.main import app
from finance_api.seed import EXTRATO_FICTICIO, seed_contas_ficticias
from ingestion_worker.extrato import carregar_extrato, processar_movimentos
from mercurio_domain import Proveniencia

client = TestClient(app)

# Todo teste deste arquivo toca o banco de teste; os de test_domain.py não.
pytestmark = pytest.mark.usefixtures("banco_de_teste_limpo")


def test_health() -> None:
    resposta = client.get("/health")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_resumo_sem_contas_traz_lista_vazia() -> None:
    resposta = client.get("/resumo")
    assert resposta.status_code == 200
    assert resposta.json()["contas"] == []


def test_resumo_traz_o_saldo_que_esta_gravado_na_conta(semear_contas) -> None:
    """O saldo mostrado vem direto da tabela `contas` (o que a Pluggy
    relata), não de somar movimentos: por isso basta gravar a conta, sem
    nenhum movimento, para o saldo já aparecer certo."""
    semear_contas(
        [
            {"id": "conta-corrente", "nome": "Banco X", "tipo": "BANK", "saldo": 480.20},
            {
                "id": "conta-cartao",
                "nome": "Cartão gold",
                "tipo": "CREDIT",
                "saldo": 340.04,
                "limite": 350.0,
                "disponivel": 9.96,
                "bandeira": "MASTERCARD",
                "final": "1234",
            },
        ]
    )

    resposta = client.get("/resumo")
    contas = {c["id"]: c for c in resposta.json()["contas"]}

    assert contas["conta-corrente"]["saldo"] == "480.20"
    assert contas["conta-corrente"]["limite"] is None
    assert contas["conta-corrente"]["bandeira"] is None
    assert contas["conta-cartao"]["saldo"] == "340.04"
    assert contas["conta-cartao"]["limite"] == "350.00"
    assert contas["conta-cartao"]["disponivel"] == "9.96"
    assert contas["conta-cartao"]["bandeira"] == "MASTERCARD"
    assert contas["conta-cartao"]["final"] == "1234"


def test_resumo_traz_a_data_e_hora_real_da_ultima_sincronizacao(semear_contas) -> None:
    semear_contas([{"id": "conta-a", "nome": "Banco X", "tipo": "BANK", "saldo": 100.00}])

    resposta = client.get("/resumo")

    assert resposta.json()["atualizado_em"] is not None


def test_resincronizar_atualiza_o_saldo_da_mesma_conta(semear_contas) -> None:
    semear_contas([{"id": "conta-a", "nome": "Banco X", "tipo": "BANK", "saldo": 100.00}])
    semear_contas([{"id": "conta-a", "nome": "Banco X", "tipo": "BANK", "saldo": 250.00}])

    resposta = client.get("/resumo")
    contas = resposta.json()["contas"]

    assert len(contas) == 1
    assert contas[0]["saldo"] == "250.00"


def test_movimentos_do_seed_ficticio_sao_gravados_ligados_as_contas(
    semear_contas, semear_movimentos
) -> None:
    """Regressão: os movimentos precisam de uma conta já existente
    (chave estrangeira); confere que o caminho completo (contas +
    movimentos) funciona, não só o resumo."""
    semear_contas(seed_contas_ficticias())
    extrato = carregar_extrato(EXTRATO_FICTICIO)
    inseridos = semear_movimentos(extrato, Proveniencia.IMPORTACAO_MANUAL.value)

    assert inseridos == 9


def test_lista_movimentos_com_filtro_por_conta_e_por_data(semear_contas, semear_movimentos) -> None:
    semear_contas(seed_contas_ficticias())
    semear_movimentos(carregar_extrato(EXTRATO_FICTICIO), Proveniencia.IMPORTACAO_MANUAL.value)

    resposta_geral = client.get("/movimentos")
    assert resposta_geral.status_code == 200
    assert len(resposta_geral.json()) == 9

    resposta_conta_b = client.get("/movimentos", params={"conta_id": "conta-b"})
    contas_no_resultado = {m["conta_id"] for m in resposta_conta_b.json()}
    assert contas_no_resultado == {"conta-b"}

    resposta_periodo = client.get(
        "/movimentos",
        params={"data_inicio": "2026-08-08", "data_fim": "2026-08-08"},
    )
    assert all(m["data"] == "2026-08-08" for m in resposta_periodo.json())
    assert len(resposta_periodo.json()) == 2  # conta-a e conta-b nesse dia


def test_lista_movimentos_pagina_com_limite_e_offset(semear_contas, semear_movimentos) -> None:
    semear_contas(seed_contas_ficticias())
    semear_movimentos(carregar_extrato(EXTRATO_FICTICIO), Proveniencia.IMPORTACAO_MANUAL.value)

    primeira_pagina = client.get("/movimentos", params={"limite": 3, "offset": 0}).json()
    segunda_pagina = client.get("/movimentos", params={"limite": 3, "offset": 3}).json()

    assert len(primeira_pagina) == 3
    assert len(segunda_pagina) == 3
    assert {m["id"] for m in primeira_pagina}.isdisjoint({m["id"] for m in segunda_pagina})


def test_gastos_diarios_soma_so_despesas_no_intervalo(semear_contas, semear_movimentos) -> None:
    """No extrato fictício, só 4 lançamentos são despesa: 300.00 (07/08,
    conta-a), 180.50 (09/08, conta-b), 65.00 (10/08, conta-b) e 71.60
    (15/08, conta-a). Receita, aporte e retirada de titular não entram."""
    semear_contas(seed_contas_ficticias())
    semear_movimentos(carregar_extrato(EXTRATO_FICTICIO), Proveniencia.IMPORTACAO_MANUAL.value)

    resposta = client.get(
        "/movimentos/gastos-diarios",
        params={"data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
    )
    assert resposta.status_code == 200
    gastos = {linha["data"]: linha["total"] for linha in resposta.json()}

    assert gastos == {
        "2026-08-07": "300.00",
        "2026-08-09": "180.50",
        "2026-08-10": "65.00",
        "2026-08-15": "71.60",
    }


def test_gastos_diarios_filtra_por_conta(semear_contas, semear_movimentos) -> None:
    semear_contas(seed_contas_ficticias())
    semear_movimentos(carregar_extrato(EXTRATO_FICTICIO), Proveniencia.IMPORTACAO_MANUAL.value)

    resposta = client.get(
        "/movimentos/gastos-diarios",
        params={"data_inicio": "2026-08-01", "data_fim": "2026-08-31", "conta_id": "conta-a"},
    )
    gastos = {linha["data"]: linha["total"] for linha in resposta.json()}

    assert gastos == {"2026-08-07": "300.00", "2026-08-15": "71.60"}


def _extrato_com_assinatura_mensal() -> pd.DataFrame:
    """Três cobranças iguais, uma por mês, na mesma conta: o padrão que a
    detecção deve encontrar."""
    return processar_movimentos(
        pd.DataFrame(
            [
                {
                    "data": data,
                    "valor": 39.90,
                    "descricao": "Assinatura streaming",
                    "conta_id": "conta-a",
                    "tipo": "despesa",
                    "identificador_externo": identificador,
                }
                for data, identificador in [
                    ("2026-06-10", "ASSIN1"),
                    ("2026-07-10", "ASSIN2"),
                    ("2026-08-10", "ASSIN3"),
                ]
            ]
        )
    )


def test_recorrencia_detectada_nasce_pendente(
    semear_contas, semear_movimentos, rodar_deteccao_de_recorrencia
) -> None:
    semear_contas(seed_contas_ficticias())
    semear_movimentos(_extrato_com_assinatura_mensal(), Proveniencia.IMPORTACAO_MANUAL.value)

    assert rodar_deteccao_de_recorrencia() == 1

    resposta = client.get("/recorrencias")
    assert resposta.status_code == 200
    (recorrencia,) = resposta.json()
    assert recorrencia["descricao"] == "Assinatura streaming"
    assert recorrencia["conta_id"] == "conta-a"
    assert recorrencia["ocorrencias"] == 3
    assert recorrencia["valor_medio"] == "39.90"
    assert recorrencia["status"] == "pendente"


def test_duplicado_possivel_nao_alimenta_deteccao_de_recorrencia(
    semear_contas, semear_movimentos, rodar_deteccao_de_recorrencia
) -> None:
    semear_contas(seed_contas_ficticias())
    extrato = _extrato_com_assinatura_mensal()
    extrato.loc[1, "duplicado_possivel"] = True
    semear_movimentos(extrato, Proveniencia.IMPORTACAO_MANUAL.value)

    assert rodar_deteccao_de_recorrencia() == 0
    assert client.get("/recorrencias").json() == []


def test_aprovar_recorrencia_tira_ela_da_fila_de_pendentes(
    semear_contas, semear_movimentos, rodar_deteccao_de_recorrencia
) -> None:
    semear_contas(seed_contas_ficticias())
    semear_movimentos(_extrato_com_assinatura_mensal(), Proveniencia.IMPORTACAO_MANUAL.value)
    rodar_deteccao_de_recorrencia()
    (recorrencia,) = client.get("/recorrencias").json()

    resposta = client.post(f"/recorrencias/{recorrencia['id']}/aprovar")

    assert resposta.status_code == 200
    assert resposta.json()["status"] == "aprovada"
    assert client.get("/recorrencias", params={"status": "pendente"}).json() == []
    assert len(client.get("/recorrencias", params={"status": "aprovada"}).json()) == 1


def test_recorrencia_rejeitada_nao_volta_na_deteccao_seguinte(
    semear_contas, semear_movimentos, rodar_deteccao_de_recorrencia
) -> None:
    """A detecção reencontra o mesmo padrão a cada sincronização. Sem a
    trava, a rejeição voltaria para a fila no dia seguinte."""
    semear_contas(seed_contas_ficticias())
    semear_movimentos(_extrato_com_assinatura_mensal(), Proveniencia.IMPORTACAO_MANUAL.value)
    rodar_deteccao_de_recorrencia()
    (recorrencia,) = client.get("/recorrencias").json()
    client.post(f"/recorrencias/{recorrencia['id']}/rejeitar")

    rodar_deteccao_de_recorrencia()

    (depois,) = client.get("/recorrencias").json()
    assert depois["status"] == "rejeitada"
    assert client.get("/recorrencias", params={"status": "pendente"}).json() == []


def test_aprovar_recorrencia_que_nao_existe_da_404() -> None:
    assert client.post("/recorrencias/999/aprovar").status_code == 404


def test_classificar_recorrencia_com_apelido_e_categoria(
    semear_contas, semear_movimentos, rodar_deteccao_de_recorrencia
) -> None:
    """A descrição do banco é o nome de quem recebeu; o apelido e a
    categoria formam a classificação pessoal."""
    semear_contas(seed_contas_ficticias())
    semear_movimentos(_extrato_com_assinatura_mensal(), Proveniencia.IMPORTACAO_MANUAL.value)
    rodar_deteccao_de_recorrencia()
    (recorrencia,) = client.get("/recorrencias").json()

    resposta = client.patch(
        f"/recorrencias/{recorrencia['id']}",
        json={"apelido": "Psicologo", "categoria": "saude", "status": "aprovada"},
    )

    assert resposta.status_code == 200
    classificada = resposta.json()
    assert classificada["apelido"] == "Psicologo"
    assert classificada["categoria"] == "saude"
    assert classificada["status"] == "aprovada"


def test_categoria_de_recorrencia_fora_da_lista_e_recusada(
    semear_contas, semear_movimentos, rodar_deteccao_de_recorrencia
) -> None:
    semear_contas(seed_contas_ficticias())
    semear_movimentos(_extrato_com_assinatura_mensal(), Proveniencia.IMPORTACAO_MANUAL.value)
    rodar_deteccao_de_recorrencia()
    (recorrencia,) = client.get("/recorrencias").json()

    resposta = client.patch(
        f"/recorrencias/{recorrencia['id']}", json={"categoria": "criptomoeda"}
    )

    assert resposta.status_code == 422


CONTAS_CORRENTE_E_CARTAO = [
    {"id": "conta-corrente", "nome": "Banco X", "tipo": "BANK", "saldo": 1000.00},
    {"id": "cartao", "nome": "Cartao X", "tipo": "CREDIT", "saldo": 335.80, "limite": 2000.00},
]


def _extrato_com_pagamento_de_fatura(valor_no_cartao: float = 335.80) -> pd.DataFrame:
    """As duas pernas do mesmo evento mais um gasto de controle.

    Na conta corrente sai "Pagamento de fatura"; no cartão entra
    "Pagamento recebido" com a categoria própria da Pluggy (05100000).
    """
    return processar_movimentos(
        pd.DataFrame(
            [
                {
                    "data": "2026-08-05",
                    "valor": 335.80,
                    "descricao": "Pagamento de fatura",
                    "conta_id": "conta-corrente",
                    "tipo": "despesa",
                    "identificador_externo": "FAT-SAIDA",
                    "categoria": "Transfers",
                    "categoria_id": "05000000",
                },
                {
                    "data": "2026-08-05",
                    "valor": valor_no_cartao,
                    "descricao": "Pagamento recebido",
                    "conta_id": "cartao",
                    "tipo": "aporte_titular",
                    "identificador_externo": "FAT-BAIXA",
                    "categoria": "Credit card payment",
                    "categoria_id": "05100000",
                },
                {
                    "data": "2026-08-06",
                    "valor": 50.00,
                    "descricao": "Mercado",
                    "conta_id": "conta-corrente",
                    "tipo": "despesa",
                    "identificador_externo": "CONTROLE",
                    "categoria": "Groceries",
                    "categoria_id": "10000000",
                },
            ]
        )
    )


def _gastos_de_agosto() -> dict[str, str]:
    resposta = client.get(
        "/movimentos/gastos-diarios",
        params={"data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
    )
    return {linha["data"]: linha["total"] for linha in resposta.json()}


def test_pagamento_de_fatura_e_detectado_e_sai_do_gasto(
    semear_contas, semear_movimentos, rodar_casamento_de_fatura
) -> None:
    """A compra no cartão já é o gasto; a saída da conta corrente que paga
    a fatura é transferência. Contar as duas é contar duas vezes."""
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(_extrato_com_pagamento_de_fatura(), Proveniencia.PLUGGY.value)

    assert rodar_casamento_de_fatura() == 1

    (detectado,) = client.get("/movimentos/pagamentos-de-fatura").json()
    assert detectado["descricao"] == "Pagamento de fatura"
    assert detectado["pagamento_de_fatura"] == "detectado"
    # Só o gasto de controle continua contando.
    assert _gastos_de_agosto() == {"2026-08-06": "50.00"}


def test_valor_diferente_nao_casa_as_duas_pernas(
    semear_contas, semear_movimentos, rodar_casamento_de_fatura
) -> None:
    """Casamento conservador: valor exato, senão não mexe."""
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(
        _extrato_com_pagamento_de_fatura(valor_no_cartao=999.00), Proveniencia.PLUGGY.value
    )

    assert rodar_casamento_de_fatura() == 0
    assert "2026-08-05" in _gastos_de_agosto()


def test_casamento_ambiguo_nao_esconde_duas_saidas(
    semear_contas, semear_movimentos, rodar_casamento_de_fatura
) -> None:
    extrato = _extrato_com_pagamento_de_fatura()
    segunda_saida = extrato.iloc[[0]].copy()
    segunda_saida.loc[:, "data"] = "2026-08-06"
    segunda_saida.loc[:, "descricao"] = "Outra transferência"
    segunda_saida.loc[:, "identificador_externo"] = "FAT-SAIDA-2"
    combinado = pd.concat([extrato, segunda_saida], ignore_index=True)
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(combinado, Proveniencia.PLUGGY.value)

    assert rodar_casamento_de_fatura() == 0
    assert client.get("/movimentos/pagamentos-de-fatura").json() == []
    assert _gastos_de_agosto() == {
        "2026-08-05": "335.80",
        "2026-08-06": "385.80",
    }


def test_duplicado_possivel_nao_e_marcado_como_pagamento_de_fatura(
    semear_contas, semear_movimentos, rodar_casamento_de_fatura
) -> None:
    extrato = _extrato_com_pagamento_de_fatura()
    extrato.loc[0, "duplicado_possivel"] = True
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(extrato, Proveniencia.PLUGGY.value)

    assert rodar_casamento_de_fatura() == 0
    assert client.get("/movimentos/pagamentos-de-fatura").json() == []
    assert _gastos_de_agosto() == {
        "2026-08-05": "335.80",
        "2026-08-06": "50.00",
    }


def test_compra_em_estabelecimento_nao_e_confundida_com_pagamento_de_fatura(
    semear_contas, semear_movimentos, rodar_casamento_de_fatura
) -> None:
    """Compra de mesmo valor e data próxima de uma baixa de fatura não pode
    ser marcada: pagar fatura é sempre transferência (categoria 05...),
    nunca compra em estabelecimento."""
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(
        processar_movimentos(
            pd.DataFrame(
                [
                    {
                        "data": "2026-06-22",
                        "valor": 30.00,
                        "descricao": "Pagamento recebido",
                        "conta_id": "cartao",
                        "tipo": "aporte_titular",
                        "identificador_externo": "BAIXA",
                        "categoria_id": "05100000",
                    },
                    {
                        "data": "2026-06-23",
                        "valor": 30.00,
                        "descricao": "Compra no débito|PostoShowFelipao",
                        "conta_id": "conta-corrente",
                        "tipo": "despesa",
                        "identificador_externo": "POSTO",
                        "categoria_id": "19050001",
                    },
                ]
            )
        ),
        Proveniencia.PLUGGY.value,
    )

    assert rodar_casamento_de_fatura() == 0

    gastos = client.get(
        "/movimentos/gastos-diarios",
        params={"data_inicio": "2026-06-01", "data_fim": "2026-06-30"},
    ).json()
    assert {linha["data"]: linha["total"] for linha in gastos} == {"2026-06-23": "30.00"}


def test_descartar_devolve_o_movimento_para_a_conta_de_gasto(
    semear_contas, semear_movimentos, rodar_casamento_de_fatura
) -> None:
    """Se o Mercúrio errou, ele desfaz e o gasto volta a contar."""
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(_extrato_com_pagamento_de_fatura(), Proveniencia.PLUGGY.value)
    rodar_casamento_de_fatura()
    (detectado,) = client.get("/movimentos/pagamentos-de-fatura").json()

    resposta = client.patch(
        f"/movimentos/{detectado['id']}/pagamento-de-fatura", json={"estado": "descartado"}
    )

    assert resposta.status_code == 200
    assert resposta.json()["pagamento_de_fatura"] == "descartado"
    assert _gastos_de_agosto() == {"2026-08-05": "335.80", "2026-08-06": "50.00"}


def test_pode_marcar_a_mao_um_pagamento_que_nao_foi_detectado(
    semear_contas, semear_movimentos, rodar_casamento_de_fatura
) -> None:
    """O outro sentido da revisão: ele marca um que o casamento não pegou."""
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(
        _extrato_com_pagamento_de_fatura(valor_no_cartao=999.00), Proveniencia.PLUGGY.value
    )
    rodar_casamento_de_fatura()
    (saida,) = [
        movimento
        for movimento in client.get("/movimentos", params={"conta_id": "conta-corrente"}).json()
        if movimento["descricao"] == "Pagamento de fatura"
    ]

    resposta = client.patch(
        f"/movimentos/{saida['id']}/pagamento-de-fatura", json={"estado": "confirmado"}
    )

    assert resposta.status_code == 200
    assert _gastos_de_agosto() == {"2026-08-06": "50.00"}


def test_receita_nao_pode_ser_confirmada_como_pagamento_de_fatura(
    semear_contas, semear_movimentos
) -> None:
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(
        processar_movimentos(
            pd.DataFrame(
                [
                    {
                        "data": "2026-08-10",
                        "valor": 100.00,
                        "descricao": "Receita fictícia",
                        "conta_id": "conta-corrente",
                        "tipo": "receita",
                        "identificador_externo": "REC-1",
                    }
                ]
            )
        ),
        Proveniencia.PLUGGY.value,
    )
    (receita,) = client.get("/movimentos").json()

    resposta = client.patch(
        f"/movimentos/{receita['id']}/pagamento-de-fatura",
        json={"estado": "confirmado"},
    )

    assert resposta.status_code == 422
    assert resposta.json()["detail"] == (
        "somente despesa de conta bancária pode ser pagamento de fatura"
    )


def test_estado_detectado_nao_pode_ser_informado_manualmente(
    semear_contas, semear_movimentos
) -> None:
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(_extrato_com_pagamento_de_fatura(), Proveniencia.PLUGGY.value)
    (saida,) = [
        movimento
        for movimento in client.get("/movimentos", params={"conta_id": "conta-corrente"}).json()
        if movimento["descricao"] == "Pagamento de fatura"
    ]

    resposta = client.patch(
        f"/movimentos/{saida['id']}/pagamento-de-fatura",
        json={"estado": "detectado"},
    )

    assert resposta.status_code == 422


def test_casamento_nao_mexe_no_que_ele_ja_decidiu(
    semear_contas, semear_movimentos, rodar_casamento_de_fatura
) -> None:
    """Rodar a sincronização de novo não pode desfazer a decisão humana."""
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(_extrato_com_pagamento_de_fatura(), Proveniencia.PLUGGY.value)
    rodar_casamento_de_fatura()
    (detectado,) = client.get("/movimentos/pagamentos-de-fatura").json()
    client.patch(
        f"/movimentos/{detectado['id']}/pagamento-de-fatura", json={"estado": "descartado"}
    )

    assert rodar_casamento_de_fatura() == 0

    (depois,) = client.get("/movimentos/pagamentos-de-fatura").json()
    assert depois["pagamento_de_fatura"] == "descartado"


def test_pagamento_de_fatura_nao_vira_recorrencia(
    semear_contas, semear_movimentos, rodar_casamento_de_fatura, rodar_deteccao_de_recorrencia
) -> None:
    """As duas pernas do pagamento não podem virar duas recorrências de
    mesmo valor."""
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    for mes in ("06", "07", "08"):
        semear_movimentos(
            processar_movimentos(
                pd.DataFrame(
                    [
                        {
                            "data": f"2026-{mes}-05",
                            "valor": 335.80,
                            "descricao": "Pagamento de fatura",
                            "conta_id": "conta-corrente",
                            "tipo": "despesa",
                            "identificador_externo": f"FAT-{mes}",
                            "categoria_id": "05000000",
                        },
                        {
                            "data": f"2026-{mes}-05",
                            "valor": 335.80,
                            "descricao": "Pagamento recebido",
                            "conta_id": "cartao",
                            "tipo": "aporte_titular",
                            "identificador_externo": f"BAIXA-{mes}",
                            "categoria_id": "05100000",
                        },
                    ]
                )
            ),
            Proveniencia.PLUGGY.value,
        )
    rodar_casamento_de_fatura()

    assert rodar_deteccao_de_recorrencia() == 0
    assert client.get("/recorrencias").json() == []


def test_cadastrar_compromisso_calcula_a_projecao_das_parcelas() -> None:
    hoje = date.today()  # noqa: DTZ011 (o endpoint compara com a data de hoje)
    resposta = client.post(
        "/compromissos",
        json={
            "descricao": "Hospedagem dividida, pagando por Pix",
            "valor_parcela": "250.00",
            "data_inicio": hoje.isoformat(),
            "data_fim": somar_meses(hoje, 5).isoformat(),
        },
    )

    assert resposta.status_code == 201
    criado = resposta.json()
    assert criado["status"] == "ativo"
    assert criado["parcelas_total"] == 6
    assert criado["parcelas_restantes"] == 6
    assert criado["proxima_parcela"] == hoje.isoformat()
    assert criado["valor_restante"] == "1500.00"


def test_compromisso_precisa_de_fim_depois_do_inicio() -> None:
    resposta = client.post(
        "/compromissos",
        json={
            "descricao": "Fim antes do inicio",
            "valor_parcela": "100.00",
            "data_inicio": "2026-06-15",
            "data_fim": "2026-01-15",
        },
    )

    assert resposta.status_code == 422


def test_compromisso_nao_aceita_parcela_zerada() -> None:
    resposta = client.post(
        "/compromissos",
        json={
            "descricao": "Parcela zerada",
            "valor_parcela": "0",
            "data_inicio": "2026-01-15",
            "data_fim": "2026-06-15",
        },
    )

    assert resposta.status_code == 422


def test_quitar_compromisso_zera_o_que_falta_pagar() -> None:
    hoje = date.today()  # noqa: DTZ011 (o endpoint compara com a data de hoje)
    criado = client.post(
        "/compromissos",
        json={
            "descricao": "Emprestimo devolvido antes",
            "valor_parcela": "250.00",
            "data_inicio": hoje.isoformat(),
            "data_fim": somar_meses(hoje, 5).isoformat(),
        },
    ).json()

    resposta = client.patch(f"/compromissos/{criado['id']}", json={"status": "quitado"})

    assert resposta.status_code == 200
    quitado = resposta.json()
    assert quitado["status"] == "quitado"
    assert quitado["proxima_parcela"] is None
    assert quitado["parcelas_restantes"] == 0
    assert quitado["valor_restante"] == "0.00"
    # O histórico de parcelas previstas continua lá, só não conta mais.
    assert quitado["parcelas_total"] == 6


def test_editar_compromisso_nao_pode_criar_estado_invalido() -> None:
    criado = client.post(
        "/compromissos",
        json={
            "descricao": "Compromisso valido",
            "valor_parcela": "100.00",
            "data_inicio": "2026-01-15",
            "data_fim": "2026-06-15",
        },
    ).json()

    resposta = client.patch(f"/compromissos/{criado['id']}", json={"data_fim": "2025-01-01"})

    assert resposta.status_code == 422


def test_listar_compromissos_filtra_por_status() -> None:
    for descricao in ("Primeiro", "Segundo"):
        client.post(
            "/compromissos",
            json={
                "descricao": descricao,
                "valor_parcela": "100.00",
                "data_inicio": "2026-01-15",
                "data_fim": "2026-06-15",
            },
        )
    (primeiro, _) = client.get("/compromissos").json()
    client.patch(f"/compromissos/{primeiro['id']}", json={"status": "cancelado"})

    ativos = client.get("/compromissos", params={"status": "ativo"}).json()

    assert [compromisso["descricao"] for compromisso in ativos] == ["Segundo"]


def test_editar_compromisso_que_nao_existe_da_404() -> None:
    assert client.patch("/compromissos/999", json={"status": "quitado"}).status_code == 404


def test_ciclos_resolve_o_ciclo_da_data_pedida() -> None:
    """05/09/2026 é sábado, então o Ciclo 1 de setembro abre na sexta,
    04/09. O painel recebe data pronta e não recalcula dia útil."""
    corpo = client.get("/ciclos", params={"referencia": "2026-09-05"}).json()

    assert corpo["atual"] == {"numero": 1, "inicio": "2026-09-04", "fim": "2026-09-14"}
    assert corpo["anterior"]["numero"] == 2
    assert corpo["seguinte"] == {"numero": 2, "inicio": "2026-09-15", "fim": "2026-10-04"}


def test_ciclos_sem_referencia_usa_hoje() -> None:
    corpo = client.get("/ciclos").json()

    inicio = date.fromisoformat(corpo["atual"]["inicio"])
    fim = date.fromisoformat(corpo["atual"]["fim"])
    assert inicio <= date.today() <= fim  # noqa: DTZ011


def test_fluxo_por_conta_separa_entrada_de_saida(semear_contas, semear_movimentos) -> None:
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(
        processar_movimentos(
            pd.DataFrame(
                [
                    {
                        "data": "2026-08-10",
                        "valor": 2500.00,
                        "descricao": "Pagamento recebido",
                        "tipo": "receita",
                        "conta_id": "conta-corrente",
                        "identificador_externo": None,
                    },
                    {
                        "data": "2026-08-11",
                        "valor": 80.00,
                        "descricao": "Mercado",
                        "tipo": "despesa",
                        "conta_id": "conta-corrente",
                        "identificador_externo": None,
                    },
                    {
                        "data": "2026-08-12",
                        "valor": 45.50,
                        "descricao": "Streaming",
                        "tipo": "despesa",
                        "conta_id": "cartao",
                        "identificador_externo": None,
                    },
                ]
            )
        ),
        Proveniencia.PLUGGY.value,
    )

    por_conta = {
        linha["conta_id"]: linha
        for linha in client.get(
            "/movimentos/por-conta",
            params={"data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
        ).json()
    }

    assert por_conta["conta-corrente"]["entradas"] == "2500.00"
    assert por_conta["conta-corrente"]["saidas"] == "80.00"
    assert por_conta["cartao"]["entradas"] == "0.00"
    assert por_conta["cartao"]["saidas"] == "45.50"


def test_duplicidade_possivel_conta_e_fica_sinalizada(
    semear_contas, semear_movimentos
) -> None:
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(
        processar_movimentos(
            pd.DataFrame(
                [
                    {
                        "data": "2026-08-11",
                        "valor": 80.00,
                        "descricao": "Compra fictícia",
                        "tipo": "despesa",
                        "conta_id": "conta-corrente",
                        "identificador_externo": "COMPRA-A",
                    },
                    {
                        "data": "2026-08-11",
                        "valor": 80.00,
                        "descricao": "Compra fictícia",
                        "tipo": "despesa",
                        "conta_id": "conta-corrente",
                        "identificador_externo": "COMPRA-B",
                    },
                ]
            )
        ),
        Proveniencia.PLUGGY.value,
    )

    (dia,) = client.get(
        "/movimentos/gastos-diarios",
        params={"data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
    ).json()
    (conta,) = [
        linha
        for linha in client.get(
            "/movimentos/por-conta",
            params={"data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
        ).json()
        if linha["conta_id"] == "conta-corrente"
    ]

    assert dia == {"data": "2026-08-11", "total": "160.00", "em_revisao": "160.00"}
    assert conta["saidas"] == "160.00"
    assert conta["em_revisao"] == "160.00"


def test_fluxo_por_conta_mostra_conta_sem_movimento_no_periodo(
    semear_contas, semear_movimentos
) -> None:
    """O painel desenha um card por conta: conta parada precisa aparecer
    zerada, não sumir da lista."""
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(
        processar_movimentos(
            pd.DataFrame(
                [
                    {
                        "data": "2026-08-11",
                        "valor": 80.00,
                        "descricao": "Mercado",
                        "tipo": "despesa",
                        "conta_id": "conta-corrente",
                        "identificador_externo": None,
                    }
                ]
            )
        ),
        Proveniencia.PLUGGY.value,
    )

    linhas = client.get(
        "/movimentos/por-conta",
        params={"data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
    ).json()

    assert {linha["conta_id"] for linha in linhas} == {"conta-corrente", "cartao"}
    (cartao,) = [linha for linha in linhas if linha["conta_id"] == "cartao"]
    assert cartao["entradas"] == "0.00"
    assert cartao["saidas"] == "0.00"


def test_fluxo_por_conta_ignora_transferencia_entre_contas_proprias(
    semear_contas, semear_movimentos
) -> None:
    """Mover dinheiro entre contas próprias não é entrada nem saída do
    conjunto: as duas pernas ficam fora."""
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(
        processar_movimentos(
            pd.DataFrame(
                [
                    {
                        "data": "2026-08-10",
                        "valor": 300.00,
                        "descricao": "Transferencia",
                        "tipo": "retirada_titular",
                        "conta_id": "conta-corrente",
                        "identificador_externo": None,
                    },
                    {
                        "data": "2026-08-10",
                        "valor": 300.00,
                        "descricao": "Transferencia",
                        "tipo": "aporte_titular",
                        "conta_id": "cartao",
                        "identificador_externo": None,
                    },
                ]
            )
        ),
        Proveniencia.PLUGGY.value,
    )

    linhas = client.get(
        "/movimentos/por-conta",
        params={"data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
    ).json()

    assert all(linha["entradas"] == "0.00" and linha["saidas"] == "0.00" for linha in linhas)


def test_fluxo_por_conta_nao_conta_pagamento_de_fatura_como_gasto(
    semear_contas, semear_movimentos, rodar_casamento_de_fatura
) -> None:
    semear_contas(CONTAS_CORRENTE_E_CARTAO)
    semear_movimentos(_extrato_com_pagamento_de_fatura(), Proveniencia.PLUGGY.value)
    rodar_casamento_de_fatura()

    por_conta = {
        linha["conta_id"]: linha
        for linha in client.get(
            "/movimentos/por-conta",
            params={"data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
        ).json()
    }

    # Só o gasto de controle de R$ 50,00, não os R$ 335,80 da fatura.
    assert por_conta["conta-corrente"]["saidas"] == "50.00"


def test_resumo_traz_fechamento_e_vencimento_da_fatura(semear_contas) -> None:
    semear_contas(
        [
            {
                "id": "conta-cartao",
                "nome": "Cartao X",
                "tipo": "CREDIT",
                "saldo": 335.80,
                "limite": 2000.00,
                "fechamento": "2026-09-08",
                "vencimento": "2026-09-15",
            }
        ]
    )

    (cartao,) = client.get("/resumo").json()["contas"]

    assert cartao["fechamento"] == "2026-09-08"
    assert cartao["vencimento"] == "2026-09-15"
