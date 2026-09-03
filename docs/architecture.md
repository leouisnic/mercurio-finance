# Arquitetura

Mercúrio é uma plataforma financeira pessoal com separação entre pessoa
física (PF) e a empresa (PJ, registrada como MEI). O painel consolidado
principal é o Vértice.

## Componentes

```
apps/web                  Next.js + React + TypeScript. PWA responsiva.
                           Painel Vértice e telas por titularidade.

services/finance-api       FastAPI. Regras de domínio, resumo financeiro
                           calculado a partir de movimentos, conciliação
                           por fingerprint. Usa o importador do
                           ingestion-worker para carregar o extrato.

services/ingestion-worker  ETL com Pandas. Importa extrato bancário,
                           planilha e XML de NFS-e. Roda como worker
                           assíncrono junto com Redis.

services/mercurio-domain   Tipos e regra de fingerprint compartilhados
                           entre finance-api e ingestion-worker.

integrations/hermes-plugin Contrato de ferramentas MCP entre o Hermes
                           Agent e o Mercúrio. Sem integração ativa ainda.

infra                      Docker Compose: PostgreSQL e Redis.

docs                       Esta pasta.
```

## Por que serviços separados

`finance-api` responde ao painel e mantém a regra de negócio. Importação de
arquivo é um processo mais pesado e assíncrono por natureza (planilha, PDF,
XML podem demorar ou falhar por item), por isso fica em
`ingestion-worker`, comunicando por fila no Redis em vez de bloquear a API.

## Workspace Python

`services/finance-api`, `services/ingestion-worker` e
`services/mercurio-domain` compartilham um workspace `uv` com lockfile
único, definido em `pyproject.toml` na raiz do repositório. Cada serviço
mantém seu próprio `pyproject.toml` e suas próprias dependências; o
`uv.lock` da raiz resolve os três ao mesmo tempo.

`mercurio-domain` existe porque a regra de fingerprint já divergiu uma vez
entre os dois serviços (formatação de valor e data diferentes fizeram o
mesmo movimento gerar fingerprints diferentes conforme a origem). Em vez
de manter as duas em sincronia manualmente, os tipos de domínio
(`Titularidade`, `TipoMovimento`, `Proveniencia`) e a função `fingerprint`
vivem só ali; `finance-api` e `ingestion-worker` importam, não
reimplementam.

## Fluxo de dado

```
extrato (CSV fictício em dev, Pluggy mais adiante)
  -> carregar_extrato() (ingestion-worker): valida, calcula fingerprint,
     marca duplicidade confirmada/possível
  -> inserir_movimentos() (finance-api/repositorio.py): grava no Postgres,
     idempotente (reimportar não duplica, ON CONFLICT DO NOTHING)
  -> GET /resumo (finance-api): lê do Postgres, agrega com
     resumir_por_titularidade() (mesma função do ingestion-worker)
  -> fetch em Server Component, cache: "no-store" (apps/web)
  -> painel Vértice
```

`apps/web` busca `finance-api` de verdade a cada carregamento da página
(`src/app/buscar-resumo.ts`); não há mais número fixo no componente. Se o
`finance-api` não estiver no ar, a página mostra uma mensagem em vez de
quebrar. A reserva do DAS ainda é um valor fixo dentro do `finance-api`: a
regra real de cálculo é decisão de negócio do Leonardo, ainda pendente.

## Persistência

`finance-api` usa SQLAlchemy 2.0 assíncrono (`asyncpg`) e Alembic para
migração. Uma tabela só, `movimentos`, com constraint única em
`(fingerprint, identificador_externo)`: é o que torna a importação
idempotente, reimportar a mesma origem (CSV ou, mais adiante, Pluggy) não
duplica saldo. `uv run --package finance-api python -m finance_api.seed`
popula o banco de desenvolvimento com o extrato fictício.

Banco de teste é **separado** do de desenvolvimento
(`mercurio_test`, não `mercurio`, criado por `infra/postgres-init/`): os
testes truncam a tabela a cada execução, e o banco de desenvolvimento é o
que vai receber dado real do Pluggy. Rodar `pytest` nunca apaga dado real.

Nota de ambiente Windows: `DATABASE_URL` e `REDIS_URL` usam `127.0.0.1`,
não `localhost`. Resolver `localhost` tenta IPv6 antes de cair para IPv4
nesta máquina, e isso sozinho já custava ~2s por conexão nova.

## Estado desta entrega

- `apps/web`: painel Vértice buscando o resumo real do `finance-api` a
  cada carregamento (Server Component assíncrono).
- `services/finance-api`: `/health` e `/resumo` (calculado a partir dos
  movimentos no Postgres), modelo de domínio com fingerprint de
  conciliação e validação de valor positivo.
- `services/ingestion-worker`: importador de extrato CSV, com validação
  explícita (titularidade, tipo, valor, data) e duas camadas de
  duplicidade (confirmada e possível), usado tanto pelos próprios testes
  quanto pelo `finance-api`. Ver
  [domain-rules.md](./domain-rules.md#conciliação-e-duplicidade).
- `services/mercurio-domain`: fingerprint e tipos compartilhados.
- `infra`: PostgreSQL (com banco de teste separado) e Redis com healthcheck
  e bind só em `127.0.0.1`.

Ainda não wireados: fila no Redis entre `finance-api` e `ingestion-worker`,
Pluggy, Telegram, autenticação, GitHub Actions e dados reais. Ver
[decisions.md](./decisions.md) para o que foi decidido e o que falta
decidir.
