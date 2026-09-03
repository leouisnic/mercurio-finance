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
A chave do fingerprint é `conta_id` (não mais titularidade, ver "Contas
dinâmicas" abaixo).

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

## Persistência: contas e movimentos, banco de teste separado

`finance-api` usa SQLAlchemy 2.0 assíncrono (`asyncpg`) e Alembic. Duas
tabelas: `contas` (saldo/limite atualizados a cada sincronização, é o que
`/resumo` devolve direto) e `movimentos` (histórico, ligado a uma conta
por `conta_id`, constraint única em `(fingerprint, identificador_externo)`
torna a importação idempotente, `ON CONFLICT DO NOTHING`). `finance_api/seed.py`
popula o banco de desenvolvimento com contas e extrato fictícios.

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
resultado) antes de plugar o job real do Pluggy.

## Pluggy real: v2/transactions, categoria própria para transferência entre contas

`GET /transactions` (paginação por página) está descontinuado pelo Pluggy
(HTTP 410, "use GET /v2/transactions"); `services/ingestion_worker/pluggy.py`
usa a v2, paginação por cursor (`next` na resposta).

Achado validando com dado real: a Pluggy já categoriza transferência entre
contas do mesmo dono como `"Same person transfer"`. Usamos essa categoria
para mapear para `aporte_titular`/`retirada_titular` (sinal do valor
decide qual), em vez de tentar adivinhar pela descrição do lançamento.
`ingestion_worker.extrato.carregar_extrato` virou uma casca fina sobre
`processar_movimentos`, para o mesmo validador/fingerprint servir tanto o
CSV quanto os dados vindos da Pluggy.

## Contas dinâmicas substituem PF/PJ e a obrigação do DAS

Depois de ver o painel rodando, o Leonardo pediu para tirar PF/PJ e a
obrigação do DAS: ele só tem contas pessoais rastreadas de verdade
(Nubank e Mercado Pago), a distinção PF/PJ que eu tinha desenhado não
correspondia a nada que ele quisesse acompanhar, e mostrar um valor fixo
de DAS que não pode ser detectado automaticamente não agregava. O
caminho até aqui (registrado só para contexto, já revertido):
`Titularidade` (pf/pj) → tentei mapear o item do Nubank no Pluggy como PJ,
errado, era PF → `ObrigacaoDas` com valor fixo e `paga` marcada à mão →
tudo isso saiu.

O que ficou (2026-09-03), ver [domain-rules.md](./domain-rules.md#contas-não-titularidade):

- `Titularidade` saiu do `mercurio-domain`; `movimentos.conta_id` (o
  próprio `accountId` que a transação da Pluggy já traz) substitui
  `titularidade` em tudo, inclusive no fingerprint.
- Nova tabela `contas` (id da Pluggy, nome, tipo, saldo, limite,
  disponível), atualizada a cada `job_sincronizar_pluggy`. `/resumo`
  devolve essa tabela direto, uma conta por card no painel.
- Cada banco tem 2 contas na Pluggy (corrente e cartão de crédito), 4
  cards ao todo hoje. Puxei o objeto real de um cartão antes de desenhar
  a tela: `balance` do cartão já é o valor usado da fatura, `creditData`
  traz `creditLimit`/`availableCreditLimit`. Conta corrente mostra
  "Saldo" (verde); cartão mostra "Fatura atual" com o limite como
  contexto (laranja, é dívida, não saldo disponível).
- `PLUGGY_ITEM_IDS` (lista separada por vírgula) substitui as variáveis
  antigas por banco: adicionar/trocar um banco é só mexer nessa lista,
  sem tocar em código. A API do Pluggy nesse plano não lista contas
  conectadas sozinha (`GET /items` sem filtro devolve 401, só busca por
  id que já se tem), então "dinâmico" aqui quer dizer nome/saldo/limite
  sempre vindos da Pluggy, não a descoberta automática de bancos novos.
- Continua em aberto (não travou esta entrega): separar compra no cartão
  de crédito do pagamento da fatura no histórico de movimentos, para não
  contar o mesmo gasto duas vezes ali.
