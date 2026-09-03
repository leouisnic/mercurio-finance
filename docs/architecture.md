# Arquitetura

Mercúrio é uma plataforma financeira pessoal com separação entre PF, PJ e
MEI. O painel consolidado principal é o Vértice.

## Componentes

```
apps/web                  Next.js + React + TypeScript. PWA responsiva.
                           Painel Vértice e telas por titularidade.

services/finance-api       FastAPI. Regras de domínio, resumo financeiro,
                           reserva do DAS, conciliação por fingerprint.

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

## Estado desta entrega

Base inicial funcional, com dados fictícios:

- `apps/web`: página inicial do Vértice mostrando saldo fictício por
  titularidade e a reserva do DAS (valor reservado e valor previsto).
- `services/finance-api`: endpoints `/health` e `/resumo`, modelo de
  domínio com fingerprint de conciliação e validação de valor positivo.
- `services/ingestion-worker`: importador de extrato CSV fictício, com
  validação explícita (titularidade, tipo, valor, data) e duas camadas de
  duplicidade (confirmada e possível). Ver
  [domain-rules.md](./domain-rules.md#conciliação-e-duplicidade).
- `services/mercurio-domain`: fingerprint e tipos compartilhados.
- `infra`: PostgreSQL e Redis com healthcheck e bind só em `127.0.0.1`,
  validados subindo os containers.

Ainda não wireados nesta entrega: comunicação entre `apps/web` e
`finance-api`, persistência em PostgreSQL, fila no Redis, Pluggy, Telegram,
autenticação, GitHub Actions e dados reais. Ver [decisions.md](./decisions.md)
para o que foi decidido e o que falta decidir.
