# Leva 1 dos números: o que esconde gasto ou mente na tela

Estado: concluída
Data: 2026-10-21. Arquivo: `docs/specs/2026-10-21-numeros-leva-1.md`.

Primeira das duas levas que corrigem os achados da revisão do Codex registrada no
`AGENTS.md`. Esta é a que não precisa de migração nem de reimportação. A da moeda (R1), com
R3 e R4, vem depois.

## Problema medido

- **R2, baixa de fatura reutilizada.** `marcar_pagamentos_de_fatura` só garante casamento
  único dentro de uma rodada. Numa sincronização seguinte, uma saída nova de mesmo valor casa
  com a mesma baixa do cartão já usada, e o gasto some da soma. Reprodução do Codex no banco
  de teste: duas saídas de R$ 1.000 marcadas para uma baixa só. No histórico real, consulta de
  2026-10-21: nenhuma baixa reutilizada; o defeito é latente.
- **R5, falha vira zero.** `movimentos/page.tsx` trata resposta nula como lista vazia
  (`gastos ?? []`), então a API fora do ar aparece como R$ 0,00 sem aviso. O comparativo e a
  lista de decididas em Recorrências fazem o mesmo.
- **R8, apelido falsifica a sincronização.** `atualizar_conta` muda o apelido pelo ORM, o
  `onupdate` de `atualizado_em` dispara, e o selo passa a dizer "sincronizado há 0 min" sem
  sincronização nenhuma.
- **R9, decisão falha em silêncio.** As server actions de `acoes.ts` não conferem a resposta
  HTTP: um PATCH que volta 503 termina como se tivesse dado certo.
- **R6, hook morto.** `.workflow/git-hooks/post-commit` aponta para `~/agent-workflow`, que
  não existe mais, e sai sem fazer nada a cada commit.
- **P04, painel exposto na rede local.** `next dev` escuta em 0.0.0.0 por padrão (medido
  pela ajuda do próprio Next). O painel lê a API pelo servidor, então qualquer aparelho do
  Wi-Fi via o extrato real e podia aprovar recorrência, sem senha.
- **Renomear conta sem tela.** `renomearConta` existe e nenhum componente chama.

## Resultado esperado

- Uma baixa de fatura nunca justifica duas saídas; a segunda continua contando como gasto.
- Com a API fora do ar, cada bloco que depende dela mostra "indisponível" com o motivo, e
  nenhum número aparece como zero.
- Renomear uma conta não muda `atualizado_em`.
- Aprovar, rejeitar, renomear ou sincronizar com a API falhando mostra o erro, mantém o que
  foi digitado e não recarrega como sucesso.
- O painel recusa conexão vinda de outro endereço que não 127.0.0.1.
- A conta pode ser renomeada na Visão geral, e o nome novo sobrevive à sincronização.
- O hook `post-commit` não existe mais, e o `AGENTS.md` deixa de citar o backup antigo.

## Escopo

**Entra:** R2, R5, R8, R9, R6, P04 e o formulário de renomear; o e2e que clica em Aprovar
contra a API real no banco fictício, depois dos testes de leitura e restaurando a base; a
checagem automática de acessibilidade das telas tocadas; prova em viewport de celular do que
esta leva toca.

**Fica de fora, de propósito:**

- token na API (B03): leva própria, logo depois desta;
- R1 moeda, R3 e R4: leva 2, que reimporta;
- layout de celular das telas inteiras: a identidade visual vai redesenhá-las; aqui o que já
  quebra no celular é só medido e registrado;
- log estruturado (B05), exportação em CSV (D05), validação de campos da Pluggy (G01), aviso
  de consentimento (H02), unificação do nome (V01) e a identidade visual: cada um na sua leva.

## Práticas consultadas

- nextjs-e-react: tela com dado financeiro real mostra só o que o usuário precisa.
- navegador-e-formularios: não mostrar sucesso com confirmação incompleta; é o R9.
- playwright: tela que depende de API prova o comportamento com ela fora do ar; ao menos uma
  prova roda contra o ambiente real; esperar o estado novo, nunca um que já era verdade.
- acessibilidade-e-contraste: `placeholder` não nomeia campo, o rótulo nomeia; contraste de
  4,5:1 para texto comum.
- postgres-e-docker e seguranca-de-dados-e-agentes: serviço local publica só em 127.0.0.1.

## Fontes consultadas

- SQL: https://www.postgresql.org/docs/17/functions-datetime.html (`date - date` devolve
  inteiro em dias, que é o que a janela de 3 dias compara).
- SQLAlchemy 2.0, defaults de coluna: https://docs.sqlalchemy.org/en/20/core/defaults.html
  (`onupdate` só dispara para coluna ausente do SET; é o que preserva `atualizado_em`).
- React, `<form action>`: https://react.dev/reference/react-dom/components/form (ao fim da
  ação o formulário é reiniciado; motivo de os formulários enviarem por `onSubmit`).
- Next.js 16.2, tratamento de erro em Server Functions e `router.refresh()`:
  https://github.com/vercel/next.js/blob/v16.2.9/docs/01-app/01-getting-started/10-error-handling.mdx
  e https://github.com/vercel/next.js/blob/v16.2.9/docs/01-app/03-api-reference/04-functions/use-router.mdx
- Playwright, dependências entre projetos: https://playwright.dev/docs/test-projects#dependencies
- Playwright, acessibilidade com axe: https://playwright.dev/docs/accessibility-testing
- MDN, `FormData(form, submitter)`:
  https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData

## Como provar

- R2: teste com a reprodução do Codex, valor calculado à mão: a segunda saída de R$ 1.000
  continua `pagamento_de_fatura` nulo e o gasto do dia é R$ 1.000.
- R5: as telas renderizadas com as buscas devolvendo nulo mostram o aviso e nenhum "R$ 0,00".
- R8: conta com `atualizado_em` antigo renomeada mantém o mesmo `atualizado_em`.
- R9: server action com a API devolvendo 503 informa erro e não revalida.
- P04: requisição ao IP da máquina na rede local recusada, e a 127.0.0.1 atendida.
- Mutação: cada regra desligada faz o seu teste falhar.

## Decisão visual

Escolhida a variante A do mockup em `local/mockups/2026-10-21-numeros-leva-1/`, entre três
conferidas em 1280 e 390 px:

- Falha da API: faixa de aviso no topo da tela dizendo quais blocos não carregaram, que nada
  ali é zero, e botão "Tentar de novo"; cada bloco afetado mostra "Indisponível" com o motivo
  no lugar do número. Recusadas a caixa de erro em cada bloco (repete a mesma mensagem) e o
  número marcado sem faixa (não explica a falha).
- Renomear: lápis ao lado do nome da conta; a edição acontece no próprio card, com Salvar,
  Cancelar e "Voltar ao nome do banco"; o erro aparece no card e o nome digitado fica. Recusados
  o campo sempre visível (ruído no card) e a janela por menu (cobre os cards no celular).

## Validações obrigatórias

```json
{"versao": 2, "natureza": "produto", "mudanca": ["logica", "tela", "dado", "permissao"], "aprovacoes": [], "locais": [{"id": "suite", "prova": "suite", "comando": ["uv", "run", "python", "scripts/validar.py", "--e2e"]}], "declaradas": {"regressao": "test_baixa_ja_usada_nao_justifica_saida_de_outra_sincronizacao, test_baixa_confirmada_a_mao_tambem_fica_usada e test_renomear_nao_finge_uma_sincronizacao falharam com o defeito e passam; os testes de api-fora-do-ar.test.tsx falharam com a tela de Movimentos do HEAD anterior e passam", "mutacao": "filtro da baixa usada ausente: os dois testes do R2 falharam; apelido pelo ORM: o teste do R8 falhou; movimentos/page.tsx anterior: dois testes do R5 falharam; acoes.ts anterior: os quatro testes de acoes.test.ts falharam", "borda": "API toda fora nas três telas, só o ciclo anterior falhando, decididas com um dos dois status falhando, fetch que lança exceção, resposta 503, voltar ao nome do banco com texto digitado, baixa confirmada à mão, select que voltava à primeira opção depois de uma falha", "diff": "git show d124470 lido; a única remoção sem substituto no mesmo arquivo é o comentário do nome longo, que foi com o cabeçalho para cabecalho-da-conta.tsx; números do banco real retirados da spec antes do commit", "tela": "computador: o Leonardo viu no painel de desenvolvimento as contas, o renomear e a faixa com a API derrubada, que é a variante A do mockup; axe sem violação WCAG A e AA nas três telas e no formulário aberto. Celular: não se aplica nesta leva, medido que a barra lateral fixa de 232 px deixa 110 px em 390 px; e2e/celular.spec.ts roda com test.fail até a navegação de celular existir", "numero": "gasto do dia na reprodução do R2 conferido à mão: 50,00 do mercado mais 335,80 da segunda transferência dá 385,80, o valor do teste; com a API fora, nenhum R$ 0,00 nas três telas", "permissao": "com o painel de pé, requisição pelo IP da rede local 192.168.15.10 e pelos outros dois endereços da máquina recusada, e por 127.0.0.1 respondeu 200"}, "aceitacoes": []}
```

## Riscos

- Mudar o casamento de fatura pode desmarcar algo hoje marcado. Medido: no histórico real não
  há baixa reutilizada, então nenhuma marcação atual deve mudar; conferir antes e depois.
- O e2e mutável pode deixar a base fictícia alterada para os outros testes se a restauração
  falhar.
- Fechar o painel em 127.0.0.1 muda a URL do e2e de `localhost` para `127.0.0.1`, porque
  `localhost` pode resolver para IPv6 no Windows.
- A marcação de fatura não guarda qual baixa usou (isso pediria migração). Por isso a baixa
  que casa com qualquer saída já marcada conta como usada, e numa ambiguidade a saída nova
  fica sem marca e soma como gasto. É o erro visível e revisável; a coluna da baixa casada
  entra se a revisão manual virar rotina.

## Autorizações necessárias

Instalar a dependência de desenvolvimento da checagem de acessibilidade, aprovada pelo dono
na decisão W02. Commit e push só com pedido. Nenhuma escrita no banco real além do que o
próprio dono fizer pela tela.

## Registro da execução

- R2: `marcar_pagamentos_de_fatura` exclui a baixa que casa com saída `detectado` ou
  `confirmado`. Testes da reprodução do Codex (R$ 335,80 em duas sincronizações; gasto do dia
  fica R$ 385,80) e da baixa confirmada à mão. No banco real, em transação só leitura: as
  marcações existentes ficaram intactas, e a regra nova não marcaria nada.
- R8: `atualizar_conta` usa UPDATE com `atualizado_em` no próprio SET. Teste com timestamp
  antigo que sobrevive ao renomear.
- R9: as server actions devolvem `{ erro }`, tratam resposta fora de 2xx como falha e só
  revalidam no sucesso. Sincronizar, decidir e renomear mostram o erro na tela.
  Achado durante a leva: com o `action` do formulário, o React chama `form.reset()` e o
  `<select>` controlado volta à primeira opção, então uma falha apagava a categoria
  escolhida. Os formulários passaram a enviar por `onSubmit`.
- R5: faixa de aviso e "Indisponível" no lugar do número em Movimentos (gráfico,
  comparativo, gasto por conta, lista), na Visão geral (entradas e saídas do ciclo) e em
  Recorrências (decididas, que antes apareciam pela metade). Tokens `aviso` novos. Na
  demonstração com a API toda fora, as telas paravam antes, na caixa cinza antiga e sem
  "Tentar de novo"; a falha total passou a usar a mesma faixa.
- Renomear conta: lápis no nome e edição no card, variante A.
- P04: `next dev` e `next start` com `-H 127.0.0.1`; e2e e README em 127.0.0.1. Medido com
  o painel de pé: o IP da rede local recusa a conexão, 127.0.0.1 responde 200.
- R6: `.workflow/git-hooks/post-commit` removido; o backup segue manual.
- Contraste: o axe acusou violações anteriores à leva nas três telas. `tinta-3` foi de 55% para
  52% de luminosidade (4,49:1 para 5,09:1 sobre o fundo), o valor de "Usado no cartão" usa
  `gasto` (6,3:1) e o botão Aprovar usa `positivo` (8,96:1 com texto branco).
- Celular, medido: a barra lateral tem 232 px fixos; em 390 px o conteúdo fica com 110 px e
  nenhum card cabe. O teste do renomear em 390 px roda marcado como falha conhecida
  (`test.fail`) até a navegação de celular existir, na leva da identidade visual.
- Provas: `scripts/validar.py --e2e` verde em 2026-10-21, com Ruff, 133 Pytest, ESLint, 42
  Vitest, build e 12 Playwright (inclui aprovar e renomear contra a API real e axe nas três
  telas). Mutação: os testes de R2, R8 e R5 falharam com o código anterior.
- `@axe-core/playwright` 4.13.0 fixado: a 4.14.0 tinha seis dias de publicada.
- Ambiente: `pytest.exe` e `uvicorn.exe` do `.venv` ainda apontavam para o caminho antigo
  do projeto e falhavam com "uv trampoline failed to canonicalize script path";
  `uv sync --all-packages --reinstall` refez os executáveis.

## Lições

- Mover o projeto de pasta não basta com `uv sync`: os executáveis de entrada do `.venv`
  guardam o caminho antigo e só são refeitos com `--reinstall`.
- `<form action>` do React reinicia o formulário inclusive depois de uma ação que devolveu
  erro, e campo controlado não basta para `<select>`. Formulário que precisa manter o
  preenchido depois de falha envia por `onSubmit`.
- `test.fail()` do Playwright não aceita estouro do prazo do teste como a falha esperada; a
  ação que deve falhar precisa de prazo próprio.
