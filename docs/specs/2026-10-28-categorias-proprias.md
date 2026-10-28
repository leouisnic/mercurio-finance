# Categorias próprias

Estado: concluída
Data: 2026-10-28. Arquivo: `docs/specs/2026-10-28-categorias-proprias.md`.

Primeira leva da cadeia escolhida na rodada de opções de 2026-10-27 (`docs/ideias.md`).
Base para a Movimentos redesenhada: a média e a meta por categoria só servem se a
categoria estiver certa.

## Problema medido

Medido no banco de desenvolvimento e nos extratos de `local/input`, só leitura, com
resultado só em contagens:

- A Pluggy classifica com modelo próprio e não lê a categoria do app do banco. Ela marca
  como transferência quase tudo que foi pago por Pix: das despesas que o dono classificou
  como alimentação no Mobills, só uma em sete a Pluggy chama de restaurante; viagem, salário
  e casa viram "Transfers".
- O Mobills tem 404 linhas classificadas pelo dono (janeiro a agosto de 2026, 24
  categorias); 355 casam com movimentos que a Pluggy já trouxe. Os extratos do Nubank do
  mesmo período já estão inteiros no banco: não há histórico a importar.
- Dos 165 destinatários de Pix ou descrições, 146 caem sempre na mesma categoria (238
  movimentos) e viram regra segura. Os outros 19 caem em várias (117 movimentos): ali a
  categoria mais comum acerta só 52%.
- Nas despesas de setembro e outubro, depois do Mobills, as regras aprendidas cobrem 40%.
  O resto é na maioria compra em que a categoria da Pluggy faz sentido (posto, transporte
  por app, restaurante, mercado).
- Validação fora do tempo: regras aprendidas de janeiro a junho, conferidas em julho e
  agosto, cobriram 26 movimentos e acertaram 19.

## Resultado esperado

- Todo movimento tem uma categoria do Mercúrio e a origem dela: correção do dono, regra
  aprendida, categoria da Pluggy traduzida, ou "para classificar".
- A ordem de decisão é fixa: correção do dono vence regra, regra vence Pluggy.
- Corrigir um movimento pode valer só para ele ou para todos do mesmo destinatário, e a
  segunda opção vira regra.
- Destinatário que já caiu em várias categorias não ganha regra: cada movimento novo dele
  entra em "para classificar".
- A categoria da Pluggy continua guardada como veio, para comparar e para não perder dado.

## Decisões do dono

Respondidas em 2026-10-28:

- Lista: B, as 19 do Mobills com as raras juntas.
- Pix misto: A, cada Pix novo dessas pessoas entra em "para classificar".
- Onde corrigir: A, na lista de Movimentos. A tela de regras espera a página Ajustes.
- Mobills: A, copiar a categoria para os movimentos casados e aprender as regras.
- Corrigir com "todos deste destinatário" muda também os movimentos antigos dele que o
  Mercúrio classificou sozinho (regra ou Pluggy). Os classificados pelo dono, à mão ou
  vindos do Mobills, não mudam.

As opções, como foram apresentadas:

1. **Lista de categorias.**
   A) As 24 do Mobills como estão. B) As do Mobills juntando as que quase não aparecem
   (seis com uma ou duas linhas: doação, reserva de emergência, operação bancária,
   bonificação, renda extra, livraria) em vizinhas, ficando perto de 18. C) Lista nova
   mais curta, de 10 a 12.
   Recomendo B: mantém o jeito que o dono já pensa e tira categoria que nunca terá média.
2. **Pix para quem recebe por várias coisas.**
   A) Cada Pix novo dessas pessoas entra em "para classificar". B) Usa a categoria mais
   comum, acertando cerca de metade. C) Categoria genérica "Pix".
   Recomendo A: são poucas pessoas, e chutar errado contamina a média por categoria.
3. **Onde corrigir.**
   A) Na lista de Movimentos, tocando na categoria do movimento, com a pergunta "só este ou
   todos deste destinatário". B) Numa tela de regras em Ajustes.
   Recomendo A agora e B quando a página Ajustes existir: corrigir onde se vê o erro.
4. **Usar o Mobills no banco local.**
   A) Copiar a categoria para os 355 movimentos casados e criar as regras dos
   destinatários sem conflito. B) Só criar as regras, sem gravar nos movimentos antigos.
   Recomendo A: sem isso, janeiro a agosto ficam sem categoria confiável e a média nasce
   torta. Grava só no Postgres local; nenhuma linha do Mobills entra no repositório.

## Escopo

**Entra:** tabela de categorias do Mercúrio e de regras, categoria própria e origem no
movimento, tradução das categorias da Pluggy, aplicação das regras na sincronização,
importação local do Mobills por comando (lido de `local/input`, nunca versionado), correção
na lista de Movimentos e o contador "para classificar".

**Fica de fora, de propósito:** média e meta por categoria (leva da Movimentos redesenhada);
tela de regras em Ajustes; enviar correções para as regras da Pluggy (escrita em serviço
externo, sem ganho enquanto a categoria própria resolve).

## Práticas consultadas

- banco-de-dados-e-modelagem: a migração é escrita contra o esquema lido do banco e provada
  com ida e volta no banco de teste antes de tocar o de desenvolvimento.
- postgres-e-docker e seguranca-de-dados-e-agentes: dado real só no Postgres local; testes,
  seed e capturas com dado fictício; o comando de importação lê `local/input` e não escreve
  arquivo nenhum.
- nextjs-e-react: a correção é Server Action que confere a resposta da API e mostra a falha,
  como as decisões de recorrência.

## Fontes consultadas

- Pluggy, Transaction Categorization:
  docs.pluggy.ai/en/docs/products/transaction-categorization (modelo próprio; correção e
  regras por cliente; categorização paga depois do período de teste).
- Pluggy, `GET /categories`: docs.pluggy.ai/en/reference/category/categories-list. A
  árvore usada na tradução foi lida da própria API, só leitura.
- Alembic, cookbook: `op.bulk_insert` sobre a tabela criada por `op.create_table`.
- SQLAlchemy 2.0, ORM Bulk UPDATE by Primary Key: `session.execute(update(Modelo),
  [dicionários com a chave])`.

## Como provar

- Teste da ordem de decisão: com correção, regra e Pluggy diferentes, vence a correção;
  sem correção, a regra; sem as duas, a tradução da Pluggy.
- Teste do destinatário com histórico em duas categorias: não gera regra e o movimento novo
  fica para classificar.
- Teste da importação com um CSV fictício no formato do Mobills: casa por data e valor,
  grava categoria e origem, e rodar duas vezes não muda nada.
- Migração com ida e volta no banco de teste.
- Contagem após a importação no banco local, conferida à mão contra a medição acima.

## Decisão visual

Escolhida no mockup `local/mockups/2026-10-28-categorias-proprias/`:

- A categoria é uma pílula na lista de Movimentos. "Para classificar" usa as cores de
  aviso.
- Tocar abre a escolha: balão sob a pílula no computador, folha que sobe de baixo no
  celular. As categorias que o destinatário já teve vêm primeiro, e destinatário misto
  começa em "só este".
- O Início mostra uma faixa "N movimentos para classificar" com o link para a fila, e
  some quando ela zera. Em Movimentos, uma pílula leva à mesma fila.
- No celular, a linha da lista vira duas: descrição e valor em cima; data, conta e
  categoria embaixo.

## Segunda parte, decidida depois de usar com o dado real

Ao classificar com o dado real, a grade de 19 botões obrigava a rolar e não tinha ícone.
Decidido nas rodadas 2 e 3 do mockup (`rodada-2.html` e `rodada-3.html`, na mesma pasta):

- **Escolha da categoria, variante A**, no computador e no celular: busca no topo, lista de
  uma coluna com ícone e cor por categoria, as já usadas pelo destinatário primeiro; "Todos de
  X / Só este" em botão de duas posições fixo no rodapé, que não rola. Ícones do
  `lucide-react`; a cor é só o tom, com claro e escuro saindo da mesma regra para manter o
  contraste medido.
- **Criar categoria** no mesmo painel: "Nova categoria" no fim da lista, e "Criar 'X'"
  quando a busca não acha nada. Nome, um entre 24 ícones e uma entre 10 cores, com prévia
  sem legenda. Ao criar, já fica escolhida. Editar e apagar esperam a página Ajustes;
  apagar vai perguntar para onde vão os movimentos.
- **Tags**: no mesmo painel, chips com autocompletar e criação. A tag só agrupa, não muda
  nenhum outro número.
- **Marcar vários**: caixa por linha no computador; no celular, botão "Selecionar" ou segurar
  a linha. Barra de ação com "Tag" e "Categoria", flutuando sobre a navegação no celular.
- **Resumo por tag** em Movimentos: total, quantidade, período e divisão por categoria, e a
  lista das tags com o total de cada uma.
- **Card do cartão no Início**: nome do banco em cima; valor, barra e limite juntos no pé, com
  o espaço que sobra no meio. Sai o texto "fatura atual, vence dia N": o vencimento vai para
  outro lugar do card, perto do final do cartão.

Implementação prevista:

- Banco: `categorias` ganha `icone` e `cor` (as 19 preenchidas pela migração) e aceita
  criação; tabelas `tags` (nome único sem distinção de caixa) e `movimento_tags`. Ida e volta
  no `mercurio_test` antes do banco local.
- API: `POST /categorias`; `GET /tags` com total e quantidade; `PUT /movimentos/{id}/tags`;
  aplicar tag e categoria a vários; filtro `tag` em `GET /movimentos`; `tags` em
  `MovimentoOut`.
- Tela: refazer `movimentos/categoria.tsx` pela variante A, mapa de ícones num módulo só,
  seleção múltipla em `lista.tsx`, resumo por tag em `movimentos/page.tsx`, ações de servidor
  que conferem a resposta; card em `resumo-painel.tsx`.
- Provas: Pytest (tag não altera gasto nem dinheiro livre, aplicar a vários, criar
  categoria), Vitest (busca, ordem do histórico, alcance, criação), Playwright de leitura e
  mutável, `celular.spec.ts`, contraste das cores novas nos dois temas, capturas fictícias.

## Validações obrigatórias

```json
{"versao": 2, "natureza": "produto", "mudanca": ["logica", "tela", "dado", "migracao"], "aprovacoes": [], "locais": [{"id": "suite", "prova": "suite", "comando": ["uv", "run", "python", "scripts/validar.py", "--e2e"]}, {"id": "contraste", "prova": "tela", "comando": ["uv", "run", "python", "scripts/contraste.py"]}], "declaradas": {"regressao": "test_categorias.py com a ordem de decisão, destinatário misto, correção só este e todos, importação do Mobills, tags, lote e criação de categoria; Vitest do painel, da busca, do padrão só este e da seleção de vários; e2e de leitura e mutável para classificar e marcar tag", "mutacao": "padrão do alcance trocado para todos: dois testes de Vitest do painel falharam; gasto da tag somando receita: o teste do gasto da tag falhou; desfeitas as duas mudanças, passaram", "borda": "destinatário misto com categoria da Pluggy fica para classificar; transferência própria recusada e pulada no lote; categoria repetida sem acento recusada; importação do Mobills rodada duas vezes sem mudar nada; correção do dono sobrevive à importação; movimento da véspera do sexto ciclo fora da fila", "diff": "diff lido; nenhum nome real nem valor do banco real em arquivo versionado; exemplos com Pessoa A, Ana Exemplo e viagem Exemplo", "tela": "capturas fictícias do painel, da seleção no celular, do resumo por tag, do submenu e das abas, nos dois temas e em 1280 e 390 px; conferido com o dado real no localhost pelo dono", "numero": "importação no banco local conferida contra a medição: 355 casados, 147 regras e 18 destinatários mistos; tag não muda o gasto por dia (teste)", "ida-e-volta": "migrações c4e1a7d93b20 e d7f3b2a91c45 com upgrade, downgrade e upgrade no mercurio_test antes do banco local"}, "aceitacoes": []}
```

## Riscos

- Se a categorização da Pluggy for desligada no fim do teste, a tradução deixa de existir e
  mais movimentos caem em "para classificar"; as regras e as correções continuam valendo.
- Regra por destinatário erra quando a pessoa muda de papel (quem recebia aluguel passa a
  receber outra coisa); a correção do dono derruba a regra e o destinatário vira misto.

## Autorizações necessárias

Migração nova no banco de desenvolvimento. Gravar categorias do Mobills no Postgres local.
Commit e push só com pedido.

## Registro da execução

- Tabelas `categorias` (19, criadas pela migração) e `regras_de_categoria`; em
  `movimentos`, `categoria_propria` e `origem_da_categoria`. Migração com ida e volta no
  `mercurio_test` antes de rodar no banco local.
- `finance_api/categorias.py` guarda a ordem de decisão, a tradução da Pluggy por prefixo e
  o mapa do Mobills. Um teste confere que todo id usado ali existe na tabela.
- A classificação roda depois de cada sincronização, no seed e depois de cada correção.
- Endpoints: `GET /categorias`, `PATCH /movimentos/{id}/categoria`,
  `GET /movimentos/para-classificar` e `para_classificar` em `GET /movimentos`, que traz
  as categorias que o dono já deu ao destinatário.
- Comando `python -m finance_api.mobills <arquivo>`. O casamento passou a exigir o mesmo
  sentido (saída com saída), que a medição não exigia: o total casado continuou 355, e as
  regras ficaram 147 com 18 destinatários mistos, contra 146 e 19 medidos.
- Banco local depois da importação, rodada duas vezes com o mesmo resultado: 355
  movimentos com a categoria do Mobills, 150 traduzidos da Pluggy, 141 por regra e 110 para
  classificar. Desses 110, 86 são de setembro a dezembro de 2025, antes do Mobills, e 16 de
  setembro e outubro de 2026.
- Decisão do dono depois da importação: a fila e o aviso cobrem só o ciclo atual e os cinco
  anteriores. Movimento mais antigo sem categoria não entra no aviso nem na fila.
- O extrato fictício ganhou a coluna `categoria_id`: o seed mostra categorias e deixa os
  dois Pix recebidos para classificar.
- Decisões tomadas sem perguntar: academia vai para Saúde, cashback para Salário e extras,
  seguro para Serviços, juros e multa de empréstimo para Taxas e tarifas; transferência,
  aplicação e resgate ficam sem tradução. A categoria de recorrência (`CategoriaRecorrencia`)
  continua separada desta lista.
- Validação: `scripts/validar.py --e2e` com 175 Pytest, 61 Vitest e 18 Playwright; contraste
  da paleta sem mudança de par. Capturas com dado fictício no computador e no celular, nos
  dois temas.

### Segunda parte

- Migração `d7f3b2a91c45`: `categorias` ganha `icone` e `cor` (as 19 preenchidas), tabelas
  `tags` (nome único por `lower(nome)`) e `movimento_tags`. Ida e volta no `mercurio_test`
  antes do banco local.
- API: `POST /categorias`, `GET /tags`, `GET /tags/{id}` com a divisão por categoria,
  `PUT /movimentos/{id}/tags`, `POST /movimentos/lote` e `tag_id` em `GET /movimentos`.
- Tela: painel da variante A em `movimentos/categoria.tsx`, ícones em `movimentos/icones.tsx`,
  seleção e barra de ação em `movimentos/lista.tsx`, filtro e resumo em `movimentos/tag.tsx`,
  card do cartão com os números no pé em `resumo-painel.tsx`.
- Cor de categoria: `--categoria-fundo` e `--categoria-icone` em `globals.css`, e
  `scripts/contraste.py` mede o ícone sobre o círculo em todos os tons, de 5 em 5 graus: pior
  caso 5,61:1 no claro e 7,69:1 no escuro.
- Decisões tomadas sem perguntar: o gasto de uma tag soma só despesas, sem descontar receita
  marcada com ela (um reembolso aparece na lista, mas não abate o total); a categoria em lote
  pula transferência própria e pagamento de fatura; ícone desconhecido vira reticências.
- Validação: `scripts/validar.py --e2e` com 181 Pytest, 66 Vitest e 19 Playwright. Capturas
  fictícias do painel, da seleção no celular e do resumo por tag; o card do cartão não aparece
  na base fictícia, que não tem cartão, e foi conferido pelos testes de componente.

### Ajustes depois de usar com o dado real

- "Vale para" começa sempre em "Só este". Começar em "Todos" criou uma regra sem querer:
  virar regra muda os próximos movimentos do destinatário e precisa ser escolha explícita.
- Categoria para vários usa a mesma busca e lista com ícones da escolha de um movimento
  (`EscolhaDeCategoria`), no lugar do `<select>` do navegador.
- O balão abre para cima quando não cabe embaixo, e a barra lateral fica fixa na altura da
  tela: aberto no fim da lista, o balão esticava a página e a barra lateral acabava no meio.
- Movimentos ganhou três páginas: Ciclo (`/movimentos`), Para classificar
  (`/movimentos/classificar`) e Tags (`/movimentos/tags`). Decidido no mockup
  `local/mockups/2026-10-28-navegacao-de-movimentos/`, variante C: submenu de títulos
  recuados, sem linha, na barra lateral do computador, e abas no celular. O número de "Para
  classificar" aparece no submenu e na aba. Os endereços antigos com `?classificar=1` e
  `?tag=N` redirecionam.
- A página principal de Movimentos é o próprio item do menu: o submenu mostra só "Para
  classificar" e "Tags", e no celular a primeira aba se chama "Resumo".
- Tela de regras: vai para a página Ajustes, junto com editar e apagar categoria, como leva
  própria depois desta. Até lá, regra se desfaz pelo chat.
- Validação: 181 Pytest, 67 Vitest e 21 Playwright.

## Lições

- A tela de Movimentos usa a data real, não `MERCURIO_HOJE`: o e2e que precisa da base
  fictícia passa `referencia=2026-08-10` na URL.
- `overflow-hidden` na lista cortava o balão de categoria; a lista agora arredonda o
  cabeçalho em vez de esconder o que passa da borda.
- Opção que vira regra não pode ser o padrão: o dono marcou "Todos" sem querer achando que
  era "Só este". Ação de alcance maior começa desligada.
- `fieldset` não encolhe dentro de um flex com altura limitada: a lista de categorias passava
  por cima das tags. Grupo que rola usa `div` com `role="radiogroup"`.
