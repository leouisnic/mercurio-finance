"""Fila do Redis, para trabalho que não pode travar uma resposta HTTP:
sincronizar com o Pluggy (rede externa) ou processar um arquivo importado.

`rq worker` (biblioteca `rq`) processa os jobs em outro processo; o
endpoint só enfileira e devolve na hora. Ver `finance_api.jobs`.
"""

from redis import Redis
from rq import Queue

from finance_api.config import REDIS_URL

conexao_redis = Redis.from_url(REDIS_URL)
fila = Queue("mercurio", connection=conexao_redis)
