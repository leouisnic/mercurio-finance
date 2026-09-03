from pathlib import Path

import pandas as pd
import pytest
from ingestion_worker.extrato import carregar_extrato, resumir_por_titularidade

FIXTURE = Path(__file__).parent / "fixtures" / "extrato_ficticio.csv"

COLUNAS = "data,valor,descricao,titularidade,tipo,identificador_externo"


def _escrever_csv(tmp_path: Path, linhas: list[str]) -> Path:
    caminho = tmp_path / "extrato.csv"
    caminho.write_text("\n".join([COLUNAS, *linhas]) + "\n", encoding="utf-8")
    return caminho


def test_carregar_extrato_marca_duplicidade_confirmada_com_mesmo_id() -> None:
    extrato = carregar_extrato(FIXTURE)

    # As duas primeiras linhas são a mesma linha de origem importada 2x:
    # mesmo fingerprint e mesmo identificador externo.
    duplicados = extrato[extrato["duplicado"]]
    assert len(duplicados) == 2

    # A terceira linha reaproveita o mesmo identificador externo (TXN123),
    # mas o conteúdo é diferente: não pode ser tratada como duplicidade.
    terceira_linha = extrato.iloc[2]
    assert terceira_linha["identificador_externo"] == "TXN123"
    assert not terceira_linha["duplicado"]
    assert not terceira_linha["duplicado_possivel"]


def test_mesmo_conteudo_com_identificador_diferente_fica_como_possivel_nao_confirmada(
    tmp_path: Path,
) -> None:
    caminho = _escrever_csv(
        tmp_path,
        [
            "2026-08-05,8.00,Cafeteria Central,pf,despesa,TXN1",
            "2026-08-05,8.00,Cafeteria Central,pf,despesa,TXN2",
        ],
    )
    extrato = carregar_extrato(caminho)

    assert not extrato["duplicado"].any()
    assert extrato["duplicado_possivel"].all()


def test_resumir_por_titularidade_ignora_so_duplicidade_confirmada() -> None:
    extrato = carregar_extrato(FIXTURE)
    resumo = resumir_por_titularidade(extrato).set_index("titularidade")["total"]

    # pj: 150 (Genux, uma vez só) + 80 (Tragial) - 200 (retirada para o titular)
    assert resumo["pj"] == pytest.approx(150.00 + 80.00 - 200.00)
    # pf: 200 (aporte vindo da PJ, espelha a retirada) - 45.90 (despesa)
    assert resumo["pf"] == pytest.approx(200.00 - 45.90)


def test_duas_compras_iguais_no_mesmo_dia_com_ids_diferentes_nao_somem_do_resumo(
    tmp_path: Path,
) -> None:
    caminho = _escrever_csv(
        tmp_path,
        [
            "2026-08-05,8.00,Cafeteria Central,pf,despesa,TXN1",
            "2026-08-05,8.00,Cafeteria Central,pf,despesa,TXN2",
        ],
    )
    extrato = carregar_extrato(caminho)
    resumo = resumir_por_titularidade(extrato).set_index("titularidade")["total"]

    assert resumo["pf"] == pytest.approx(-16.00)


def test_titularidade_invalida_e_rejeitada(tmp_path: Path) -> None:
    caminho = _escrever_csv(
        tmp_path, ["2026-08-05,10.00,Compra qualquer,xx,despesa,TXN1"]
    )

    with pytest.raises(ValueError, match="Titularidade ou tipo inválido"):
        carregar_extrato(caminho)


def test_tipo_invalido_e_rejeitado(tmp_path: Path) -> None:
    caminho = _escrever_csv(
        tmp_path, ["2026-08-05,10.00,Compra qualquer,pf,estorno,TXN1"]
    )

    with pytest.raises(ValueError, match="Titularidade ou tipo inválido"):
        carregar_extrato(caminho)


def test_valor_ausente_e_rejeitado(tmp_path: Path) -> None:
    caminho = _escrever_csv(tmp_path, ["2026-08-05,,Tarifa nao informada,pj,despesa,TXN1"])

    with pytest.raises(ValueError, match="Valor ausente"):
        carregar_extrato(caminho)


def test_valor_negativo_ou_zero_e_rejeitado(tmp_path: Path) -> None:
    caminho = _escrever_csv(tmp_path, ["2026-08-05,-45.90,Mercado,pf,despesa,TXN1"])

    with pytest.raises(ValueError, match="deve ser positivo"):
        carregar_extrato(caminho)


def test_data_fora_do_formato_iso_e_rejeitada(tmp_path: Path) -> None:
    caminho = _escrever_csv(tmp_path, ["05/08/2026,10.00,Compra qualquer,pf,despesa,TXN1"])

    with pytest.raises(ValueError, match="Data inválida"):
        carregar_extrato(caminho)


def test_titularidade_e_normalizada_antes_de_agrupar(tmp_path: Path) -> None:
    caminho = _escrever_csv(
        tmp_path,
        [
            "2026-08-05,100.00,Pagamento A,PJ,receita,TXN1",
            "2026-08-06,50.00,Pagamento B,pj,receita,TXN2",
        ],
    )
    extrato = carregar_extrato(caminho)
    resumo = resumir_por_titularidade(extrato).set_index("titularidade")["total"]

    assert list(resumo.index) == ["pj"]
    assert resumo["pj"] == pytest.approx(150.00)


def test_fingerprint_bate_com_o_pacote_compartilhado_para_valor_float_e_decimal() -> None:
    from decimal import Decimal

    from mercurio_domain import fingerprint

    linha = pd.Series(
        {
            "titularidade": "pj",
            "valor": 1500.5,
            "descricao": "Nota fiscal",
            "tipo": "receita",
        }
    )
    import datetime as _dt

    do_worker = fingerprint(
        linha["titularidade"],
        _dt.date(2026, 8, 5),
        linha["valor"],
        linha["descricao"],
        linha["tipo"],
    )
    da_api = fingerprint(
        "pj", _dt.date(2026, 8, 5), Decimal("1500.50"), "Nota fiscal", "receita"
    )

    assert do_worker == da_api
