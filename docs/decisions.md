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

## DAS não é uma linha de despesa no extrato (superado, ver correção abaixo)

A mesma revisão encontrou que tratar o DAS como um lançamento de despesa
importado faria o valor sair do saldo duas vezes quando fosse realmente
pago. Naquele momento eu ainda achava que a PJ era uma conta conectada no
Pluggy; ficou substituído pela correção "Obrigação do DAS é manual, não
inferida", mais abaixo, quando ficou claro que o DAS nem aparece no
extrato conectado.

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

## PJ e MEI são a mesma titularidade

`Titularidade` no `mercurio-domain` tem só `pf` e `pj`, não um terceiro
valor `mei`. Confirmado com o Leonardo em 2026-09-03: o CNPJ dele é
registrado como MEI, e a conta Nubank PJ é a conta desse mesmo CNPJ, não
existe um "saldo do MEI" separado do saldo da PJ. MEI é o regime
tributário da PJ (o que muda como o DAS é calculado), não uma terceira
titularidade com dinheiro próprio. Ver
[domain-rules.md](./domain-rules.md#titularidades).

## Persistência: uma tabela, constraint única, banco de teste separado

`finance-api` ganhou SQLAlchemy 2.0 assíncrono (`asyncpg`) e Alembic. Uma
tabela só, `movimentos`, com constraint única em
`(fingerprint, identificador_externo)`: reimportar a mesma origem não
duplica saldo, sem precisar de lógica extra no código (`ON CONFLICT DO
NOTHING`). `finance_api/seed.py` popula o banco de desenvolvimento com o
extrato fictício.

Banco de teste (`mercurio_test`) é separado do de desenvolvimento
(`mercurio`), criado por `infra/postgres-init/001-create-test-db.sql`
(só roda num volume novo: se precisar recriar depois de já ter dado real,
recrie o volume manualmente ou rode o SQL à mão). Os testes truncam
`mercurio_test` a cada execução; `mercurio` é o único que recebe dado real
do Pluggy, e nenhum teste aponta para ele.

## localhost custava ~2s por conexão no Windows

Resolver `localhost` tentava IPv6 antes de cair para IPv4 nesta máquina,
adicionando ~2s a cada conexão nova do Postgres (a suíte de teste foi de
1,3s para 60s só com isso). `DATABASE_URL`, `TEST_DATABASE_URL` e
`REDIS_URL` usam `127.0.0.1` explícito por causa disso.

## Fila do Redis: SimpleWorker, não `rq worker`

RQ workers padrão precisam de `fork()`, que o Windows não tem
(documentação oficial da lib: "workers cannot run natively on Windows").
`finance_api/worker.py` sempre usa `SimpleWorker` (roda o job no mesmo
processo, sem fork), com `TimerDeathPenalty` no lugar do mecanismo padrão
baseado em sinal. Os jobs (`finance_api/jobs.py`) vivem na `finance-api`,
não no `ingestion-worker`: ela já depende do `ingestion-worker` para o
parser e já é dona da persistência, então é o lugar natural para o
consumidor da fila.

`POST /sync/seed` e `GET /sync/{job_id}` existem para provar a fila de
ponta a ponta (enfileira, processa em processo separado, confere
resultado) antes de plugar o job real do Pluggy na Fase B.

## Obrigação do DAS: valor fixo real, marcada como paga à mão

O Leonardo informou o valor real que paga hoje, R$ 86,05/mês, em vez de
eu calcular por tabela de atividade do MEI. `ObrigacaoDas` (troca de
`ReservaDas`) usa esse valor fixo, configurável por `DAS_VALOR`.

`paga` não é inferida do extrato: descobri, olhando o dado real já
importado, que nenhuma transação com "DAS" na descrição existe no que
está conectado, porque o pagamento sai da conta PJ (não conectada, ver
domain-rules.md). Em vez de uma heurística que nunca ia encontrar nada,
`POST /das/pagar` marca a competência atual como paga (grava uma linha em
`obrigacoes_das`, idempotente); `paga_em` fica registrado.

## Pluggy real: v2/transactions, categoria da própria Pluggy para transferência entre titularidades

`GET /transactions` (paginação por página) está descontinuado pelo Pluggy
(HTTP 410, "use GET /v2/transactions"); `services/ingestion_worker/pluggy.py`
usa a v2, paginação por cursor (`next` na resposta).

Achado validando com dado real: a Pluggy já categoriza transferência entre
contas do mesmo titular como `"Same person transfer"`. Usamos essa
categoria para mapear para `aporte_titular`/`retirada_titular` (sinal do
valor decide qual), em vez de tentar adivinhar pela descrição do
lançamento. `ingestion_worker.extrato.carregar_extrato` virou uma casca
fina sobre `processar_movimentos`, para o mesmo validador/fingerprint
servir tanto o CSV quanto os dados vindos da Pluggy.

Cada item (conexão bancária) tem mais de uma conta: Nubank e Mercado Pago
devolveram conta corrente/pré-paga E cartão de crédito, quatro contas ao
todo. Confirmado com o Leonardo: importar as duas por titularidade agora,
aceitando o risco de dupla contagem entre a compra no cartão e o
pagamento da fatura (a fatura paga também vira uma despesa na conta
corrente). Ajustar essa regra é trabalho futuro, não travou a Fase B.

`job_sincronizar_pluggy` (`services/finance-api/src/finance_api/jobs.py`)
roda a sincronização completa: autentica, lista contas de cada `itemId`
em `CONTAS_PLUGGY`, busca transações de cada conta, mapeia e grava no
Postgres pelo mesmo caminho idempotente do seed. Testado com o cliente da
Pluggy mockado (nunca a API real nos testes) e validado contra a API e o
banco de desenvolvimento de verdade, com o resultado conferido
manualmente antes de seguir.

## Correção: as duas contas conectadas no Pluggy são PF, não PJ

Mapeei errado na Fase B: tratei o item do Nubank como PJ. O Leonardo
corrigiu (2026-09-03): a conta Nubank conectada no Pluggy é PF. A conta PJ
dele existe de verdade, mas é outra conta, não conectada no Pluggy, e
funciona só como intermediária para receber pagamento de nota fiscal
(saldo sempre perto de zero, por instrução do contador). Ver
[domain-rules.md](./domain-rules.md#contas-reais-e-o-que-está-conectado-no-pluggy).

Corrigido: variáveis de ambiente renomeadas por banco, não por titularidade
presumida (`PLUGGY_ITEM_ID_NUBANK`, `PLUGGY_ITEM_ID_MERCADOPAGO`, no lugar
de `..._PJ`/`..._PF`); `CONTAS_PLUGGY` em `finance_api/jobs.py` mapeia as
duas para `"pf"` hoje. Os 724 movimentos já importados foram apagados do
banco de desenvolvimento e reimportados com o mapeamento certo (mesmo
caminho idempotente, sem risco de duplicar). `/resumo` real depois da
correção: PF R$ 948,83, PJ R$ 0,00 (nenhuma conta conectada).

## O que ainda não foi decidido

- Estrutura de autenticação do painel: senha única simples, via
  `PAINEL_SENHA`, ainda não implementada.
- Separar compra no cartão de crédito do pagamento da fatura, para não
  contar o mesmo gasto duas vezes.
- Se um dia a conta PJ for conectada no Pluggy, `CONTAS_PLUGGY` ganha uma
  terceira entrada e a obrigação do DAS passa a poder ser detectada
  automaticamente lá, em vez de só marcada à mão.
