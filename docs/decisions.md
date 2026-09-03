# Decisões técnicas

Registro curto de decisões já tomadas e por que. Decisões de negócio estão
em [domain-rules.md](./domain-rules.md).

## Repositório próprio, fora de hermes-agent e agent-workflow

O código do Mercúrio fica só em `mercurio-finance`. `hermes-agent` é um
projeto separado e não deve ser tocado por este. `agent-workflow` é
privado do Leonardo e guarda só backup de instruções e memória técnica,
nunca código.

## Workspace uv para os serviços Python

`finance-api`, `ingestion-worker` e `mercurio-domain` compartilham
lockfile único via workspace do uv, em vez de ambientes virtuais
independentes. Reduz divergência de versão entre os três sem forçar todos
a serem o mesmo pacote.

## Tailwind no apps/web

`create-next-app` inclui Tailwind por padrão nesta versão. Mantido porque
ajuda a entregar a página inicial responsiva rapidamente; pode ser
removido depois se não fizer sentido para o restante do painel.

## Fingerprint em vez de identificador externo

Ver [domain-rules.md](./domain-rules.md#conciliação-e-duplicidade). Motivado
por casos reais observados nos dados do Leonardo, não é uma escolha
teórica.

## mercurio-domain como pacote separado

Revisão de casos de domínio (2026-09-03) encontrou que `finance-api` e
`ingestion-worker` calculavam fingerprint com formatação de valor e data
diferentes: o mesmo movimento vindo de fontes diferentes podia não ser
reconhecido como igual. Em vez de alinhar as duas implementações à mão (o
que pode divergir de novo na próxima mudança), a regra virou um terceiro
membro do workspace uv, `services/mercurio-domain`, importado pelos dois.

## Portas do Postgres/Redis só em localhost

Revisão de infraestrutura (2026-09-02) apontou que `infra/docker-compose.yml`
publicava as portas em `0.0.0.0`/IPv6 com credenciais previsíveis de
desenvolvimento. Corrigido para bind só em `127.0.0.1`. Ver
[security.md](./security.md#portas-do-postgres-e-do-redis-só-em-localhost).

## Duas camadas de duplicidade (confirmada e possível)

Mesma revisão de 2026-09-03 encontrou que confiar só no fingerprint de
conteúdo para descartar duplicidade automaticamente tinha o problema
oposto ao que motivou o fingerprint: duas compras legítimas e iguais no
mesmo dia (mesmo valor, mesma descrição) eram fundidas em uma só. A
correção usa fingerprint E identificador externo iguais para duplicidade
confirmada (some do resumo); fingerprint igual com identificador diferente
vira duplicidade possível, sinalizada mas não removida automaticamente.
Ver [domain-rules.md](./domain-rules.md#conciliação-e-duplicidade).

## Reserva do DAS não é uma linha de despesa no extrato

A mesma revisão encontrou que tratar a reserva do DAS como um lançamento
de despesa faria o valor sair do saldo duas vezes quando o DAS fosse
realmente pago. A reserva ficou como valor calculado à parte
(`ReservaDas` na `finance-api`), não como um movimento importado do
extrato. Ver [domain-rules.md](./domain-rules.md#reserva-do-das).

## apps/web consome finance-api por fetch direto em Server Component

`src/app/page.tsx` é um Server Component assíncrono que busca
`GET /resumo` (`cache: "no-store"`, sempre um dado atual, nunca cacheado
entre requisições) e passa o resultado para `ResumoPainel`, um componente
síncrono só de apresentação. Essa separação existe porque o Next.js não
suporta testar Server Component assíncrono direto no Vitest (confirmado na
documentação oficial); `ResumoPainel` e a função `buscarResumo` (que faz o
fetch e converte string para number) são testados separadamente no Vitest,
e o fluxo completo (os dois serviços conversando de verdade) é validado
pelo Playwright, que sobe `finance-api` e `apps/web` juntos.

Se o `finance-api` estiver fora do ar, a página mostra uma mensagem em vez
de quebrar (sem página de erro dedicada nesta etapa).

## Total do worker convertido para Decimal na borda da finance-api

O `ingestion-worker` soma em `float` (natureza do pandas). O `finance-api`
converte para `Decimal` com 2 casas fixas via `Decimal(str(total)).quantize(...)`,
não só `round()` (que não garante 2 casas quando o resultado é uma dezena
redonda, ex: `round(2550.0, 2)` continua `2550.0`, não `2550.00`).

## O que ainda não foi decidido

- Modelagem de tabelas no PostgreSQL (ainda não há migração nesta
  entrega; `infra` sobe o banco, mas nenhum serviço lê ou escreve nele).
- Formato da fila no Redis entre `finance-api` e `ingestion-worker`.
- Estrutura de autenticação do painel.
- Como a reserva do DAS será de fato calculada (percentual da receita da
  PJ no mês, valor fixo configurável, ou outra regra); hoje o valor no
  painel e na API é fixo e provisório, sem lógica por trás. É decisão de
  negócio do Leonardo, não só técnica.
