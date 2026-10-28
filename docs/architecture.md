# Arquitetura

Mercúrio é uma plataforma financeira pessoal. O painel (`apps/web`) mostra contas
conectadas, movimentos, ciclos e indicadores calculados pela API.

## Componentes

```text
apps/web                   Next.js, React e TypeScript. PWA responsiva.
services/finance-api       FastAPI, regras de aplicação e Postgres.
services/ingestion-worker  ETL, cliente Pluggy e processamento assíncrono.
services/mercurio-domain   Tipos e fingerprint compartilhados.
integrations/hermes-plugin Contrato MCP, ainda sem integração ativa.
infra                      PostgreSQL e Redis em Docker Compose.
docs                       Arquitetura, domínio, segurança e decisões.
```

## Fluxo de dados

```text
Pluggy e importadores locais
  -> validação e normalização no ingestion-worker
  -> fingerprint no mercurio-domain
  -> fila Redis
  -> persistência e conciliação no finance-api
  -> endpoints de leitura
  -> Server Components do painel
```

O saldo exibido vem diretamente da conta sincronizada. O histórico de
movimentos não reconstrói esse saldo, pois pode possuir períodos incompletos.

## Persistência

O `finance-api` usa SQLAlchemy assíncrono, asyncpg e Alembic. As tabelas atuais
são:

- `contas`: estado mais recente de cada conta conectada, mais o apelido que o
  dono escolheu, que a sincronização não sobrescreve;
- `movimentos`: histórico e dados de conciliação;
- `recorrencias`: padrões sugeridos e decisão humana;
- `compromissos`: obrigações futuras cadastradas manualmente;
- `categorias`: as categorias do Mercúrio, criadas pela migração;
- `regras_de_categoria`: a categoria de cada destinatário, ou a marca de que
  ele é misto;
- `tags` e `movimento_tags`: os grupos que o dono marca nos movimentos.

A categoria do Mobills entra no banco local pelo comando
`python -m finance_api.mobills <arquivo>`, que lê a exportação de onde ela
está e não grava arquivo.

Postgres e Redis ficam acessíveis somente em `127.0.0.1`. O banco de teste é
separado e protegido contra configuração acidental para desenvolvimento.

## API e interface

`apps/web` busca o `finance-api` com `cache: "no-store"`. Filtros de conta,
ciclo e página ficam na URL. A interface não replica regras de ciclo ou
agregação financeira.

As telas são Visão geral, Movimentos (com as páginas Ciclo, Para classificar e Tags) e
Recorrências. As mutações usam server
action, sem cliente HTTP no navegador: a página recarrega com
`revalidatePath` depois da chamada.

Os principais grupos de endpoints são:

- resumo das contas, e o apelido editável de cada uma;
- movimentos, gastos diários e fluxo por conta;
- categorias, correção da categoria de um movimento e fila para classificar;
- tags, resumo por tag e marcação de vários movimentos de uma vez;
- ciclos de pagamento;
- recorrências e compromissos;
- sincronização assíncrona por Redis e RQ.

## Integrações

A Pluggy é usada apenas para leitura. Importações de CSV são locais. XML de
NFS-e, Telegram, autenticação, ferramentas MCP ativas e observabilidade ficam
para etapas posteriores.

Qualquer futura operação que mova dinheiro ou altere nota fiscal exigirá
confirmação humana.
