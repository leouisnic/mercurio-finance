"""API financeira do Mercúrio.

`/resumo` devolve as contas conectadas no Pluggy (nome, tipo, saldo e,
para cartão de crédito, limite/disponível), lidas direto da tabela
`contas` (ver `finance_api.repositorio`): o mesmo saldo que a Pluggy
relata, atualizado a cada `POST /sync/pluggy`, não uma soma refeita a
partir do histórico de movimentos. Popule o banco local com
`uv run --package finance-api python -m finance_api.seed` (dado
fictício) antes de rodar em desenvolvimento sem Pluggy configurado.

Nenhuma credencial, extrato real ou dado pessoal é usado neste módulo.
"""

from datetime import date

from fastapi import Depends, FastAPI, HTTPException
from rq.exceptions import NoSuchJobError
from rq.job import Job
from sqlalchemy.ext.asyncio import AsyncSession

from finance_api.db import obter_sessao
from finance_api.domain import Conta, ResumoFinanceiro
from finance_api.fila import conexao_redis, fila
from finance_api.jobs import job_reimportar_seed, job_sincronizar_pluggy
from finance_api.repositorio import listar_contas

app = FastAPI(
    title="Mercúrio · finance-api",
    description="Contas conectadas no Pluggy e seus saldos.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/resumo", response_model=ResumoFinanceiro)
async def resumo(
    sessao: AsyncSession = Depends(obter_sessao),  # noqa: B008 (padrão do FastAPI)
) -> ResumoFinanceiro:
    contas = await listar_contas(sessao)

    return ResumoFinanceiro(
        atualizado_em=date.today(),  # noqa: DTZ011 (data de exibição, sem sensibilidade a fuso)
        contas=[
            Conta(
                id=conta.id,
                nome=conta.nome,
                tipo=conta.tipo,
                saldo=conta.saldo,
                limite=conta.limite,
                disponivel=conta.disponivel,
            )
            for conta in contas
        ],
    )


@app.post("/sync/seed", status_code=202)
def sincronizar_seed() -> dict[str, str]:
    """Enfileira a reimportação do extrato fictício, sem travar a resposta.

    Existe para provar a fila do Redis de ponta a ponta antes do job real
    do Pluggy; é seguro rodar mais de uma vez, a importação é idempotente.
    Consulte o resultado em GET /sync/{job_id}.
    """
    job = fila.enqueue(job_reimportar_seed)
    return {"job_id": job.id, "status": job.get_status()}


@app.post("/sync/pluggy", status_code=202)
def sincronizar_pluggy() -> dict[str, str]:
    """Enfileira a sincronização real com o Pluggy (todos os bancos em
    `PLUGGY_ITEM_IDS`), sem travar a resposta. Só leitura na Pluggy;
    escrita no Postgres é idempotente. Consulte o resultado em
    GET /sync/{job_id}.
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
