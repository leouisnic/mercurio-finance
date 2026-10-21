<h1>Mercúrio</h1>

A personal finance dashboard that reads Brazilian bank and credit card accounts through Open
Finance and shows where the money goes, one pay cycle at a time.

[![CI](https://github.com/leouisnic/mercurio-finance/actions/workflows/ci.yml/badge.svg)](https://github.com/leouisnic/mercurio-finance/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.13-informational)
![TypeScript](https://img.shields.io/badge/typescript-5-informational)
![Stage](https://img.shields.io/badge/stage-in%20development-yellow)

<img alt="Overview screen: one card per connected account, with balance, credit card usage against the limit, and inflows and outflows in the current cycle" src="docs/telas/visao-geral.png">

## The problem

Each bank app shows one account at a time, and adding them up by hand counts a credit card
purchase twice: once when you buy, and again when you pay the bill. Calendar months also miss how money
actually moves between paydays that land on business days. Mercúrio brings every account
into one place through Open Finance, counts each purchase once, and groups spending by pay
cycle.

## What it does

- **Overview** (the Vértice dashboard): one card per connected account, with balance, card
  usage against the limit, and inflows and outflows in the current cycle.
- **Transactions**: daily spending chart, comparison with the previous cycle, spending per
  account and the transaction list, filtered by cycle and account.
- **Recurring charges**: monthly charges are detected from history and wait for a human
  decision, because a subscription and a fixed-term installment look identical in the data.
- **Pay cycles** follow business days: two per month, starting on the business day on or
  before the 5th and on or after the 15th. Fixed national holidays come from law, and the
  movable ones (Carnival, Good Friday, Corpus Christi) are computed from the date of Easter.
- **Card bill payments** are matched on both sides, the checking account and the card, and
  kept out of spending totals. Every automatic match can be reviewed and undone.

Access to Open Finance is read-only: nothing in this project moves money.

<p>
  <img alt="Transactions screen: daily spending chart, comparison with the previous cycle and the transaction list" src="docs/telas/movimentos.png" width="49%">
  <img alt="Recurring charges screen: a detected monthly charge waiting for approval, with fields for a nickname and a category" src="docs/telas/recorrencias.png" width="49%">
</p>

The interface is in Portuguese. Every screenshot uses fictional data.

## Quick start

Requirements: Node 20 or later, Python 3.13 or later, [uv](https://docs.astral.sh/uv/) and
Docker. Commands are shown for PowerShell; on bash, write `export NAME="value"` instead of
`$env:NAME = "value"`.

Start PostgreSQL and Redis:

```
cd infra
cp .env.example .env
docker compose up -d
cd ..
```

Start the API on the test database, seeded with a fictional statement:

```
uv sync --all-packages
$env:DATABASE_URL = "postgresql+asyncpg://mercurio:mercurio@127.0.0.1:5432/mercurio_test"
uv run --package finance-api alembic -c services/finance-api/alembic.ini upgrade head
uv run --package finance-api python -m finance_api.seed
uv run --package finance-api uvicorn finance_api.main:app --port 8100
```

In another terminal, start the dashboard:

```
cd apps/web
npm install
$env:FINANCE_API_URL = "http://localhost:8100"
npm run dev -- --port 3100
```

- Open `http://localhost:3100`. The demo reads only the fictional data in `mercurio_test`.
- Pytest and Playwright reset that database, so do not run them while using the demo.
- The Sync button needs Pluggy credentials in `.env` and the queue worker
  (`uv run --package finance-api python -m finance_api.worker`). The demo works without both.

## Structure

```
apps/web                    Next.js, React, TypeScript, Tailwind. The Vértice dashboard.
services/finance-api        FastAPI, SQLAlchemy, Alembic. API, PostgreSQL, Redis queue.
services/ingestion-worker   Pandas importers for CSV statements and Pluggy.
services/mercurio-domain    Shared types and the reconciliation fingerprint.
integrations/hermes-plugin  MCP tool contract for an agent integration.
infra                       Docker Compose for PostgreSQL and Redis.
scripts                     Local validation.
docs                        Architecture, domain rules, security and decisions.
```

## How to run and how to prove it

```
uv run python scripts/validar.py
uv run python scripts/validar.py --e2e
```

- `validar.py` runs a content check, Ruff, Pytest, ESLint, Vitest and the Next.js build.
  With `--e2e` it adds Playwright, driving the dashboard against a real `finance-api` on the
  fictional test database.
- The test suite refuses a remote database, or one whose name does not end in `_test`, so it
  cannot reach real data.
- CI runs on every push to `main` and on pull requests: Alembic migrations on an empty
  database, Ruff and Pytest, then ESLint, the build, Vitest and Playwright.

## What to read, and when

The documents in `docs/` are written in Portuguese.

- **Before** touching any account, amount, pay cycle or recurring charge, read
  [docs/domain-rules.md](./docs/domain-rules.md): it defines what the correct number is.
- **Before** changing a service, the queue or the database, read
  [docs/architecture.md](./docs/architecture.md).
- **Before** handling credentials, real data or committed examples, read
  [docs/security.md](./docs/security.md).
- **When** a past decision looks wrong, read [docs/decisions.md](./docs/decisions.md) before
  proposing to change it: the reason is usually there.

## Data

This repository never contains real financial data, credentials, bank statements or
certificates. Real account data stays in a local development database and never enters Git.
Fixtures, the seed and every screenshot are fictional.
