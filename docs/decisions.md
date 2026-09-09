# Decisões técnicas

Registro das decisões atuais. Regras financeiras ficam em
[domain-rules.md](./domain-rules.md).

## Repositórios separados

O código do Mercúrio vive apenas em `mercurio-finance`. `hermes-agent` é
outro produto. `agent-workflow` guarda somente instruções, memória e backup
privados.

## Workspace Python

`finance-api`, `ingestion-worker` e `mercurio-domain` compartilham um lockfile
via workspace do uv. O pacote `mercurio-domain` centraliza tipos e fingerprint
para impedir divergência entre ingestão e persistência.

## Contas dinâmicas

Cada conta informada pela Pluggy é persistida com o identificador externo,
nome e natureza `BANK` ou `CREDIT`. O saldo do card vem da própria instituição,
não da soma local do histórico.

## Conciliação em duas camadas

Fingerprint e identificador externo iguais formam duplicidade confirmada e não
são inseridos novamente. Fingerprint igual com identificador diferente forma
possível duplicidade. O valor continua nos totais e aparece como valor em
revisão até existir decisão humana.

## Banco e fila locais

Postgres e Redis publicam portas somente em `127.0.0.1`. A API usa SQLAlchemy
assíncrono e Alembic. O worker usa `SimpleWorker`, compatível com Windows, e
descarta o pool assíncrono ao terminar cada job.

## Pluggy somente leitura

O cliente usa `/v2/transactions`, segue paginação por cursor e classifica o
sentido pelo campo `type`. `DEBIT` representa saída e `CREDIT` representa
entrada, independentemente do sinal de `amount`. Resposta sem tipo válido ou
paginação incompleta faz a sincronização falhar sem persistir lote parcial.

## Pagamento de fatura

A baixa informada no cartão é ligada a uma saída bancária apenas quando existe
um casamento único por valor exato, janela de três dias, categoria de
transferência e natureza das contas. Ambiguidade não é resolvida
automaticamente. A marcação pode ser confirmada ou descartada por uma pessoa.

## Recorrências e compromissos

Recorrência é inferida de três despesas encadeadas, com intervalo de 28 a 35
dias e variação de valor de até 15%. A candidata nasce pendente. Compromisso é
cadastrado manualmente com começo e fim e não é conciliado automaticamente.

## Ciclos de pagamento

O Ciclo 1 começa no dia bancário útil anterior ou igual ao dia 5 e termina na
véspera do primeiro dia bancário útil posterior ou igual ao dia 15. O Ciclo 2
ocupa o intervalo restante até a véspera do primeiro ciclo do mês seguinte.
O cálculo fica apenas na API.

O calendário inicial usa fins de semana, feriados nacionais de data fixa,
segunda e terça de Carnaval, Sexta-feira da Paixão e Corpus Christi. Carnaval e
Corpus Christi são dias sem expediente do mercado financeiro, embora não sejam
feriados nacionais por lei. A Sexta-feira da Paixão é definida localmente. Por
isso o código chama o conjunto de datas não úteis, e não de feriados nacionais.
Feriados estaduais e municipais ainda não são modelados.

## Interface web

O Next.js busca a API em Server Components com `cache: "no-store"`. Filtros e
paginação ficam na URL. A base visual usa Sora, Tailwind CSS 4, tema claro e
componentes próprios para os gráficos atuais.

## Migrações e testes

O schema é criado exclusivamente por Alembic. Testes usam banco local separado
com nome terminado em `_test`. O CI executa Ruff, Pytest, ESLint, Vitest, build,
migrações desde banco vazio e Playwright.
