"""Fila do Redis, para trabalho que não pode travar uma resposta HTTP:
sincronizar com o Pluggy (rede externa) ou processar um arquivo importado.

`rq worker` (biblioteca `rq`) processa os jobs em outro processo; o
endpoint só enfileira e devolve na hora. Ver `finance_api.jobs`.
"""

from redis import Redis
from rq import Queue
from sqlalchemy.engine import make_url

from finance_api.config import DATABASE_URL, REDIS_URL


def nome_da_fila(database_url: str) -> str:
    """Uma fila por banco. O Redis é um só para o painel real, a demonstração
    e o e2e, e o worker grava no banco dele: com a fila compartilhada, uma
    tarefa enfileirada pela demonstração rodava no banco real."""
    return f"mercurio:{make_url(database_url).database}"


conexao_redis = Redis.from_url(REDIS_URL)
fila = Queue(nome_da_fila(DATABASE_URL), connection=conexao_redis)
