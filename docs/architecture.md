# Arquitetura

Mercúrio é uma plataforma financeira pessoal. O painel consolidado
principal, Vértice, mostra o saldo de cada conta que o Leonardo conecta
via Open Finance (Pluggy), uma por card, sempre com o nome e o valor que
o próprio banco relata.

## Componentes

```
apps/web                  Next.js + React + TypeScript. PWA responsiva.
                           Painel Vértice, um card por conta conectada.

services/finance-api       FastAPI. Contas e movimentos no Postgres,
                           fila de sincronização no Redis.

services/ingestion-worker  ETL com Pandas e cliente da Pluggy (só
                           leitura). Importa extrato bancário, planilha e
                           XML de NFS-e; roda como worker assíncrono
                           junto com Redis.

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
(`TipoMovimento`, `Proveniencia`) e a função `fingerprint` vivem só ali;
`finance-api` e `ingestion-worker` importam, não reimplementam.

## Fluxo de dado

```
Pluggy: /accounts (saldo, limite) e /v2/transactions (histórico)
  -> mapear_conta() / mapear_para_movimento() (ingestion-worker/pluggy.py)
  -> processar_movimentos() (ingestion-worker/extrato.py): valida, calcula
     fingerprint, marca duplicidade confirmada/possível
  -> upsert_contas() + inserir_movimentos() (finance-api/repositorio.py):
     grava no Postgres, idempotente
  -> GET /resumo (finance-api): lê a tabela `contas` direto, sem agregar
     movimentos (o saldo já vem certo da própria Pluggy)
  -> fetch em Server Component, cache: "no-store" (apps/web)
  -> painel Vértice, um card por conta
```

`apps/web` busca `finance-api` de verdade a cada carregamento da página
(`src/app/buscar-resumo.ts`); não há número fixo no componente. Se o
`finance-api` não estiver no ar, a página mostra uma mensagem em vez de
quebrar.

O saldo mostrado no painel vem direto da tabela `contas`, atualizada a
cada sincronização com o que a Pluggy relata (`balance`, e para cartão de
crédito `creditData.creditLimit`/`availableCreditLimit`), não de somar o
histórico de movimentos, que pode ficar incompleto ou defasado. Os
movimentos continuam gravados (para histórico e conciliação), só não são
mais a fonte do número que aparece no card.

## Persistência

`finance-api` usa SQLAlchemy 2.0 assíncrono (`asyncpg`) e Alembic para
migração. Duas tabelas: `contas` (id da Pluggy, nome, tipo, saldo,
limite/disponível, atualizada a cada sincronização) e `movimentos`
(ligado a uma conta por `conta_id`, com constraint única em
`(fingerprint, identificador_externo)`, o que torna a importação
idempotente: reimportar a mesma origem não duplica). `uv run --package
finance-api python -m finance_api.seed` popula o banco de desenvolvimento
com contas e extrato fictícios, para rodar sem Pluggy configurado.

Banco de teste é **separado** do de desenvolvimento
(`mercurio_test`, não `mercurio`, criado por `infra/postgres-init/`): os
testes truncam as tabelas a cada execução, e o banco de desenvolvimento é
o que recebe dado real do Pluggy. Rodar `pytest` nunca apaga dado real.

Nota de ambiente Windows: `DATABASE_URL` e `REDIS_URL` usam `127.0.0.1`,
não `localhost`. Resolver `localhost` tenta IPv6 antes de cair para IPv4
nesta máquina, e isso sozinho já custava ~2s por conexão nova.

## Estado desta entrega

- `apps/web`: painel Vértice, um card por conta conectada (Server
  Component assíncrono buscando `/resumo` a cada carregamento).
- `services/finance-api`: `/health`, `/resumo` (contas direto do
  Postgres), `/sync/seed` e `/sync/pluggy` (enfileiram importação e
  sincronização real, `/sync/{job_id}` confere o resultado), modelo de
  domínio com fingerprint de conciliação e validação de valor positivo.
- `services/ingestion-worker`: importador de extrato CSV e cliente da
  Pluggy (`pluggy.py`, só leitura: contas, saldo, limite e transações),
  com validação explícita (conta, tipo, valor, data) e duas camadas de
  duplicidade (confirmada e possível), usado tanto pelos próprios testes
  quanto pelo `finance-api`. Ver
  [domain-rules.md](./domain-rules.md#conciliação-e-duplicidade).
- `services/mercurio-domain`: fingerprint e tipos compartilhados.
- `infra`: PostgreSQL (com banco de teste separado) e Redis com healthcheck
  e bind só em `127.0.0.1`, usados de verdade (persistência e fila).

Pluggy está sincronizando dado real (Nubank e Mercado Pago, conta
corrente e cartão de crédito de cada um) no banco de desenvolvimento
local; esse dado nunca entra no Git. Ainda não wireados: Telegram,
autenticação do painel. Ver [decisions.md](./decisions.md) para o que foi
decidido, incluindo o que já foi tentado e revertido.
