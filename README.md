# Mercúrio

Plataforma financeira pessoal. O painel consolidado principal, Vértice,
mostra o saldo de cada conta conectada via Open Finance (Pluggy), uma por
card, com o nome e o valor que o próprio banco relata.

Projeto de portfólio em desenvolvimento. Todo dado usado neste
repositório, incluindo os exemplos e os testes, é fictício.

## Estrutura

```
apps/web                  Next.js, React, TypeScript. Painel Vértice.
services/finance-api       FastAPI. Resumo financeiro, persistência no
                           Postgres e fila de sincronização no Redis.
services/ingestion-worker  Importadores (CSV, Pluggy) e ETL com Pandas.
services/mercurio-domain   Tipos e fingerprint compartilhados entre os dois.
integrations/hermes-plugin Contrato de ferramentas MCP com o Hermes Agent.
infra                      Docker Compose (PostgreSQL, Redis).
docs                       Arquitetura, regras de domínio, segurança e decisões.
```

Detalhes em [docs/architecture.md](./docs/architecture.md).

## Stack

Next.js, React, TypeScript, Tailwind CSS · Python, FastAPI, SQLAlchemy,
Alembic, RQ, Pandas, uv · PostgreSQL · Redis · Docker Compose ·
Pluggy/Open Finance (leitura) · Pytest, Vitest, Playwright · GitHub
Actions.

Planejado para etapas seguintes: Telegram Bot, autenticação do painel, PWA
completa, Hermes Agent via MCP.

## Rodando localmente

Pré-requisitos: Node 20+, Python 3.13+, `uv`, Docker Desktop.

Infraestrutura local:

```
cd infra
cp .env.example .env
docker compose up -d
```

API financeira. Para demonstração, use o banco de teste e nunca o banco local
que recebe sincronizações reais:

```
uv sync --all-packages
$env:DATABASE_URL = "postgresql+asyncpg://mercurio:mercurio@127.0.0.1:5432/mercurio_test"
uv run --package finance-api alembic -c services/finance-api/alembic.ini upgrade head
uv run --package finance-api python -m finance_api.seed
uv run --package finance-api uvicorn finance_api.main:app --port 8100
```

Worker da fila (processa `/sync/*`; sem ele, os jobs ficam enfileirados
sem rodar):

```
uv run --package finance-api python -m finance_api.worker
```

Sincronizar com o Pluggy de verdade (leitura, Open Finance; precisa das
credenciais no `.env` e do worker rodando):

```
curl -X POST http://localhost:8000/sync/pluggy
curl http://localhost:8000/sync/<job_id devolvido acima>
```

Painel web:

```
cd apps/web
npm install
$env:FINANCE_API_URL = "http://localhost:8100"
npm run dev -- --port 3100
```

Abra `http://localhost:3100` ou `http://localhost:3100/movimentos`. Não rode
Pytest ou Playwright enquanto estiver usando essa demonstração, pois essas
suítes limpam o banco `mercurio_test`.

## Testes

```
uv run python scripts/validar.py
uv run python scripts/validar.py --e2e
```

`npm run test:e2e` sobe o `finance-api` de verdade sozinho (via `uv run`), então
precisa do workspace Python sincronizado (`uv sync --all-packages` na raiz)
antes de rodar. A suíte recusa banco remoto ou sem o sufixo `_test`, limpa esse
banco local e o semeia novamente com o extrato fictício.

## Dados

Este repositório não contém e nunca vai conter dados financeiros reais,
credenciais, extratos ou certificados. Todo exemplo é fictício.
