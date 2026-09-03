"""API financeira do Mercúrio.

`/resumo` calcula o saldo por titularidade a partir dos movimentos
gravados no Postgres (ver `finance_api.repositorio`), reusando a mesma
regra de agregação do `ingestion-worker`. Popule o banco local com
`uv run --package finance-api python -m finance_api.seed` (dado
fictício) antes de rodar em desenvolvimento.

A obrigação do DAS é um valor fixo mensal (não derivado de movimento
importado, ver `finance_api.domain.ObrigacaoDas`); marcar como paga é
manual, `POST /das/pagar`. Nenhuma credencial, extrato real ou dado
pessoal é usado neste módulo.
"""

from datetime import date
from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException
from ingestion_worker.extrato import resumir_por_titularidade
from rq.exceptions import NoSuchJobError
from rq.job import Job
from sqlalchemy.ext.asyncio import AsyncSession

from finance_api.config import DAS_VALOR
from finance_api.db import obter_sessao
from finance_api.domain import (
    ObrigacaoDas,
    ResumoFinanceiro,
    ResumoTitularidade,
    Titularidade,
)
from finance_api.fila import conexao_redis, fila
from finance_api.jobs import job_reimportar_seed, job_sincronizar_pluggy
from finance_api.repositorio import carregar_movimentos, das_esta_pago, marcar_das_pago

app = FastAPI(
    title="Mercúrio · finance-api",
    description="Resumo financeiro por titularidade e obrigação do DAS.",
    version="0.1.0",
)

NOME_POR_TITULARIDADE = {
    Titularidade.PF: "Pessoa Física",
    Titularidade.PJ: "Pessoa Jurídica (MEI)",
}


def _competencia_atual() -> str:
    return date.today().strftime("%Y-%m")  # noqa: DTZ011 (competência de calendário, não fuso)


def _saldo_em_decimal(total: float) -> Decimal:
    """Converte o total (float, vindo do pandas) para Decimal com 2 casas
    fixas. `round()` sozinho não garante isso: `round(2550.0, 2)` continua
    `2550.0`, que vira `"2550.0"` em vez de `"2550.00"` na API."""
    return Decimal(str(total)).quantize(Decimal("0.01"))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/resumo", response_model=ResumoFinanceiro)
async def resumo(
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> ResumoFinanceiro:
    movimentos = await carregar_movimentos(sessao)

    totais = (
        resumir_por_titularidade(movimentos).set_index("titularidade")["total"]
        if not movimentos.empty
        else {}
    )

    titularidades = [
        ResumoTitularidade(
            titularidade=titularidade,
            nome=NOME_POR_TITULARIDADE[titularidade],
            saldo=_saldo_em_decimal(totais.get(titularidade.value, 0.0)),
        )
        for titularidade in Titularidade
    ]

    competencia = _competencia_atual()
    obrigacao_das = ObrigacaoDas(
        competencia=competencia,
        valor=Decimal(DAS_VALOR),
        paga=await das_esta_pago(sessao, competencia),
    )

    return ResumoFinanceiro(
        atualizado_em=date.today(),  # noqa: DTZ011 (data de exibição, sem sensibilidade a fuso)
        titularidades=titularidades,
        obrigacao_das=obrigacao_das,
    )


@app.post("/das/pagar")
async def marcar_das_pago_da_competencia_atual(
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> ObrigacaoDas:
    """Marca a obrigação do DAS da competência atual como paga. Manual: o
    pagamento sai da conta PJ, que não está conectada no Pluggy, então não
    tem como detectar isso sozinho a partir do extrato."""
    competencia = _competencia_atual()
    await marcar_das_pago(sessao, competencia)
    return ObrigacaoDas(competencia=competencia, valor=Decimal(DAS_VALOR), paga=True)


@app.post("/sync/seed", status_code=202)
def sincronizar_seed() -> dict[str, str]:
    """Enfileira a reimportação do extrato fictício, sem travar a resposta.

    Existe para provar a fila do Redis de ponta a ponta antes do job real
    do Pluggy (Fase B); é seguro rodar mais de uma vez, a importação é
    idempotente. Consulte o resultado em GET /sync/{job_id}.
    """
    job = fila.enqueue(job_reimportar_seed)
    return {"job_id": job.id, "status": job.get_status()}


@app.post("/sync/pluggy", status_code=202)
def sincronizar_pluggy() -> dict[str, str]:
    """Enfileira a sincronização real com o Pluggy (Nubank e Mercado
    Pago), sem travar a resposta. Só leitura na Pluggy; escrita no Postgres
    é idempotente. Consulte o resultado em GET /sync/{job_id}.
    """
    job = fila.enqueue(job_sincronizar_pluggy, job_timeout=300)
    return {"job_id": job.id, "status": job.get_status()}


@app.get("/sync/{job_id}")
def status_sincronizacao(job_id: str) -> dict[str, object]:
    try:
        job = Job.fetch(job_id, connection=conexao_redis)
    except NoSuchJobError as erro:
        raise HTTPException(status_code=404, detail="job não encontrado") from erro

    return {
        "job_id": job.id,
        "status": job.get_status(),
        "resultado": job.return_value(),
    }
