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

Infraestrutura (PostgreSQL e Redis, ainda sem uso real por nenhum serviço):

```
cd infra
cp .env.example .env
docker compose up -d
```

API financeira (o painel busca nela; sem ela no ar, a página mostra uma
mensagem de erro em vez do resumo):

```
uv sync --all-packages
uv run --package finance-api uvicorn finance_api.main:app --reload
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
