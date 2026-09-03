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

Infraestrutura (PostgreSQL e Redis, ainda sem uso real por nenhum serviço):

```
cd infra
cp .env.example .env
docker compose up -d
```

API financeira (o painel busca nela; sem ela no ar, a página mostra uma
mensagem de erro em vez do resumo). Primeira vez, aplique a migração e
popule o banco de desenvolvimento com dado fictício:

```
uv sync --all-packages
cp .env.example .env   # preencha com suas credenciais locais
cd services/finance-api
uv run alembic upgrade head
uv run python -m finance_api.seed
cd ../..
uv run --package finance-api uvicorn finance_api.main:app --reload
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
npm run dev
```

Por padrão o painel busca a API em `http://localhost:8000`. Para apontar
para outro endereço, defina `FINANCE_API_URL` antes de rodar `npm run dev`.

## Testes

```
uv run ruff check .
uv run pytest
cd apps/web && npm run lint && npm run build && npm run test && npm run test:e2e
```

`npm run test:e2e` sobe o `finance-api` de verdade sozinho (via `uv run`), então
precisa do workspace Python sincronizado (`uv sync --all-packages` na raiz)
antes de rodar.

## Dados

Este repositório não contém e nunca vai conter dados financeiros reais,
credenciais, extratos ou certificados. Todo exemplo é fictício.
