"""Processa os jobs da fila.

`rq worker` (o comando padrão da lib) precisa de `fork()`, que o Windows
não tem: "workers cannot run natively on Windows" (documentação oficial do
RQ). Por isso este módulo sempre usa `SimpleWorker` (roda o job no mesmo
processo, sem fork), com `TimerDeathPenalty` no Windows em vez do
mecanismo padrão baseado em sinal, que também não existe lá.

Uso: uv run --package finance-api python -m finance_api.worker
"""

import sys

from rq import SimpleWorker

from finance_api.fila import conexao_redis, fila

if sys.platform == "win32":
    from rq.timeouts import TimerDeathPenalty

    class _Worker(SimpleWorker):
        death_penalty_class = TimerDeathPenalty
else:
    _Worker = SimpleWorker


def main() -> None:
    worker = _Worker([fila], connection=conexao_redis)
    worker.work()


if __name__ == "__main__":
    main()
