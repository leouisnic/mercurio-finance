# Mercúrio

Plataforma financeira pessoal com separação entre pessoa física (PF),
pessoa jurídica (PJ) e MEI. O painel consolidado principal se chama
Vértice.

Projeto de portfólio em desenvolvimento. Todo dado usado neste
repositório, incluindo os exemplos e os testes, é fictício.

## Estrutura

```
apps/web                  Next.js, React, TypeScript. Painel Vértice.
services/finance-api       FastAPI. Regras de domínio e resumo financeiro.
services/ingestion-worker  Importadores e ETL com Pandas.
services/mercurio-domain   Tipos e fingerprint compartilhados entre os dois.
integrations/hermes-plugin Contrato de ferramentas MCP com o Hermes Agent.
infra                      Docker Compose (PostgreSQL, Redis).
docs                       Arquitetura, regras de domínio, segurança e decisões.
```

Detalhes em [docs/architecture.md](./docs/architecture.md).

## Stack

Next.js, React, TypeScript, Tailwind CSS · Python, FastAPI, Pandas, uv ·
PostgreSQL · Redis · Docker Compose · Pytest, Vitest, Playwright.

Planejado para etapas seguintes: Pluggy/Open Finance (leitura), Telegram
Bot, PWA completa, Hermes Agent via MCP, GitHub Actions.

## Rodando localmente

Pré-requisitos: Node 20+, Python 3.13+, `uv`, Docker Desktop.

Infraestrutura (PostgreSQL e Redis):

```
cd infra
cp .env.example .env
docker compose up -d
```

Painel web:

```
cd apps/web
npm install
npm run dev
```

API financeira:

```
uv sync --all-packages
uv run --package finance-api uvicorn finance_api.main:app --reload
```

## Testes

```
cd apps/web && npm run lint && npm run build && npm run test && npm run test:e2e
uv run ruff check .
uv run pytest
```

## Dados

Este repositório não contém e nunca vai conter dados financeiros reais,
credenciais, extratos ou certificados. Todo exemplo é fictício.
