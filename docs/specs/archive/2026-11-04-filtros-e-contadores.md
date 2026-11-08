# Filtros e contadores

Estado: concluída
Data: 2026-11-04. Arquivo: `docs/specs/archive/2026-11-04-filtros-e-contadores.md`.

Retomada em 2026-11-06: integração interrompida concluída, incluindo a sétima rodada visual.
A versão final foi preparada para validação e revisão independente. A migração de
cotas foi conferida no banco de teste e aplicada no banco local com autorização.

## Problema medido

- Nenhuma tela de dados tem filtro além de ciclo e conta em Movimentos. O Início não filtra
  nada, e a página Tags lista tudo: o dono passou a escrever mês e ano no nome da tag para
  achar o que procura.
- Não há contagem de dias sem gasto, de sequência, de dias dentro da cota nem comparação com
  o ciclo anterior; o dono conta de cabeça olhando o gráfico.
- O gráfico de gasto por dia repete a cota numa etiqueta acima dele, que já aparece em
  "Hoje dá para gastar", e não diz o dia da semana nem quais dias não são úteis.
- O ciclo usa só feriados nacionais. Um feriado da cidade de quem paga antecipa o pagamento
  e muda o ciclo, e o Mercúrio não sabe disso.

## Resultado esperado

- Barra de filtros no mesmo padrão no Início, em Movimentos e em Tags, guardada no endereço
  da página: período (ciclo atual, ciclo anterior, mês, datas), conta, categoria e tag (só a
  tag ou sem a tag), mais de uma conta, categoria ou tag de cada vez.
- No Início, os filtros mudam só a análise (gráfico e contadores). "Hoje dá para gastar",
  cota, cofrinho e composição do saldo continuam do ciclo atual e de todas as contas.
- Contadores no ciclo e no mês: dias de ouro (sem gasto), também no total; sequência atual
  e recorde sem gasto; dias dentro e acima da cota; gasto até hoje contra o ciclo anterior.
- Tags ganha também situação (em andamento, encerrada, arquivada), busca pelo nome e teto
  (com teto, passou do teto, sem teto); ano e mês pegam a tag com período ou gasto neles.
- Gráfico de gasto por dia, no Início e em Movimentos: a cota sai da etiqueta e vai para o
  balão da linha tracejada (mouse, foco e toque); cada dia mostra a letra do dia da semana;
  fim de semana e feriado ficam marcados, com o nome do feriado no detalhe.
- Nasce a página Ajustes (`/ajustes`, último item da navegação),
  onde mora o que é cadastro e regra. Nesta leva ela tem só a seção Feriados; as outras
  seções da ideia "Página Ajustes" entram na leva dela, no mesmo lugar.
- Feriado da cidade cadastrado pelo dono em Ajustes: nome, data, se repete todo ano e de quem ele muda
  o dia de pagamento (quem paga o ciclo 1, quem paga o ciclo 2 ou nenhum). Sem nenhum, só
  marca. Marcado para um pagador, entra no cálculo do dia útil daquele pagamento, como os
  nacionais já entram.

## Regras dos números

Decididas nesta spec para poderem ser contestadas antes do código:

- Gasto do dia é o mesmo do gráfico de cada tela: no Início, o do dia a dia (sem fatura e sem
  conta fixa, como o dinheiro livre); em Movimentos, todas as despesas.
- Os dias contados vão do início do período até hoje, inclusive. Hoje conta como dia de ouro
  enquanto não houver gasto nele.
- Total de dias de ouro: desde o primeiro movimento importado.
- Dentro da cota: gasto do dia até a cota, inclusive. A cota observada de cada ciclo passa
  a ser guardada; a observação mais recente substitui a anterior. Não reconstruir ciclos
  anteriores sem observação. Período parcial e filtro de conta, categoria ou tag ficam sem
  cota. Cota negativa não produz dias dentro da cota. A média inclui dias passados sem gasto.
- A observação registra também o fim do ciclo. O reaproveitamento exige início e fim
  correspondentes, pois feriado editável pode alterar o intervalo. Observação legada com
  fim desconhecido fica preservada e fora do contador até uma observação válida.
- Comparação: mesmo número de ciclo do mês anterior, até a mesma posição no ciclo,
  limitada ao fim do ciclo comparado. Só há comparação para um ciclo inteiro. O nome de
  quem paga vem da configuração e acompanha mudanças nela.
- Projeção: gasto observado mais a média dos últimos sete dias passados (incluindo zeros)
  multiplicada pelos dias restantes. Sem dia observado ou sem dia restante, não há projeção.
- Ao navegar entre Início e Movimentos, preservar os filtros no endereço. Paginação e
  parâmetros de outras páginas não são carregados junto. Voltar e recarregar mantêm o recorte.
- Mês é o mês do calendário, que corta dois ciclos.

## Escopo

**Entra:** tabela de feriados com migração; o calendário de ciclos recebe os feriados por
pagador; API dos contadores e dos filtros novos (categoria, tag com inclusão ou exclusão,
várias contas) nas rotas de movimentos, gastos por dia e tags; componente único de barra de
filtros; contadores; gráfico com dia da semana, dia não útil e cota no balão; página
Ajustes com a seção Feriados.

**Fica de fora, de propósito:** "Dinheiro livre quando estoura" e "Plano do ciclo", que
mudam o cálculo do livre e vêm na leva seguinte; feriado estadual automático (o dono
cadastra o da cidade); filtros na página Recorrências; as outras seções de Ajustes (recorrências,
compromissos, nomes de contas e pagadores, regras por destinatário, categorias, ocultar
conta), que ficam para a leva "Página Ajustes".

## Práticas consultadas

- acessibilidade-e-contraste: dia não útil marcado também pela letra e pelo detalhe, não só
  pela cor de fundo; balão da cota abre no foco e no toque, não só no mouse; contraste do
  fundo de dia não útil medido por `scripts/contraste.py` nos dois temas.
- nextjs-e-react: filtros no endereço da página (`searchParams`), lidos no servidor; o
  componente de cliente recebe só os campos que mostra.
- navegador-e-formularios: caixa de seleção do feriado lida por `checked`; resposta da API
  conferida antes de virar contador.
- banco-de-dados-e-modelagem e postgres-e-docker: data do feriado em `date`, nunca texto;
  migração com ida e volta no banco de teste antes do local.
- python-ruff-e-pytest: contadores e calendário com feriado por pagador testados com valor
  calculado à mão.
- playwright: e2e da barra de filtros no endereço e do cadastro de feriado; largura do
  celular conferida em cada tela que ganha filtro.

## Fontes consultadas

- [Next.js 16.3.4, useSearchParams](https://github.com/vercel/next.js/blob/v16.3.4/docs/01-app/03-api-reference/04-functions/use-search-params.mdx): leitura dos parâmetros no cliente e limite de Suspense, também conferidos no Context7.
- [React Day Picker 10.0.2, intervalos](https://github.com/gpbl/react-day-picker/blob/v10.0.2/apps/website/docs/selections/range-mode.mdx): seleção controlada com `selected` e `onSelect`, também conferida no Context7. Mantido o pacote já instalado.
- [Next.js, servidor e cliente](https://nextjs.org/docs/app/getting-started/server-and-client-components): fronteira de módulos e dados serializáveis. Aplicado e conferido no build instalado 16.3.4; constantes de estilo compartilhadas fora de `use client`.
- [PostgreSQL 17, CREATE TABLE](https://www.postgresql.org/docs/17/sql-createtable.html): chave primária da cota é o início do ciclo e o valor usa tipo decimal.
- [Alembic, tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html): ida e volta com downgrade e upgrade, executada com Alembic 1.19.1 instalado, também consultada no Context7.
- [Playwright, toque](https://playwright.dev/docs/api/class-locator#locator-tap): contexto com toque e teste do primeiro toque, também consultado no Context7.
- [Tailwind CSS 4.3, overflow](https://tailwindcss.com/docs/overflow) e [altura mínima](https://tailwindcss.com/docs/min-height), conferidos com Context7 e a versão 4.3.3 instalada. A moldura mantém o padding e a região interna usa `min-h-0` com rolagem vertical.
- [Vitest, limite de workers](https://vitest.dev/config/maxworkers.html), conferido com Context7 e o código instalado 4.1.11. A validação local pode limitar a concorrência por `VITEST_MAX_WORKERS`, sem filtrar testes.
- [React, estado ajustado quando a prop muda](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes), conferido no Context7 e na documentação oficial. O endereço confirmado redefine os rascunhos e a chave do calendário redefine seu intervalo.
- [Alembic, add_column](https://alembic.sqlalchemy.org/en/latest/ops.html#alembic.operations.Operations.add_column), conferido no Context7 e na documentação oficial. A coluna `fim` aceita nulo para preservar observações legadas sem inventar seu intervalo.
- [Next.js, cancelamento de resposta](https://github.com/vercel/next.js/pull/96715). O código instalado 16.3.4 e o relato oficial são compatíveis com as mensagens de stream do e2e. A conexão exata que as originou permanece hipótese contextual.

## Como provar

- Pytest, valores à mão: ciclo fictício de 15 dias com 5 sem gasto dá 5 dias de ouro;
  sequência que termina hoje e recorde que atravessa dois ciclos; dentro da cota com um dia
  exatamente na cota; comparação pelo dia N com ciclos de 20 e 21 dias.
- Pytest do calendário: feriado da cidade num dia 5 útil antecipa P1 só quando marcado para
  o pagador do ciclo 1; o mesmo feriado sem marca não muda nada; feriado nacional continua
  igual.
- Vitest: barra de filtros escreve e lê o endereço; contador some fora do ciclo atual e com
  filtro; letra do dia da semana e dia não útil no gráfico.
- Playwright: filtro pelo endereço no Início, Movimentos e Tags; cadastro de feriado; nada
  passa da largura de 390 px.

## Decisão visual

Mockup em `local/mockups/2026-11-04-filtros-e-contadores/`, três variantes: A, barra de
filtros e quatro cartões de contador com desenho, coluna sombreada no dia não útil
(recomendada); B, botão Filtrar com etiquetas e faixa de contadores no gráfico, dia não útil
só na letra; C, período em abas e contadores em lista ao lado do gráfico.

- Opção A: barra de filtros sempre à vista, quatro cartões de contador com desenho e
  coluna sombreada no dia não útil. Recusadas a B (filtro escondido atrás de um botão) e
  a C (contadores em lista ao lado espremem o gráfico).
- Página Ajustes, segunda rodada: opção A, lista de seções à esquerda (as que ainda não
  existem como "em breve") e a seção aberta à direita; feriado com bloco de data, etiqueta
  colorida do efeito, formulário aberto por "Novo feriado" e pagador escolhido em cartão;
  nacionais em etiquetas. Recusadas a B (grade de ladrilhos esconde a seção atrás de um
  clique a mais) e a C (calendário do ano ocupa a tela para três feriados).
- Plano do restante aceito (`restante.html`).
- Marcação dos dias, terceira rodada: fundo só na letra do dia da semana, cinza no fim de
  semana e colorido no feriado; colunas limpas. Recusadas: só ícone (pouco visível), tudo
  junto (carregado) e faixa embaixo (longe do dia). Legenda curta: Dia de ouro, Dentro da
  cota, Passou da cota, Fim de semana, Feriado.
- Cor do feriado, quarta rodada: turquesa (tom 175), que não lembra o dourado dos dias de
  ouro nem o vermelho e o índigo das barras. Recusados magenta e azul celeste.

- Quinta rodada: dia não útil (fim de semana e feriado) em magenta com a letra cheia (B),
  com o nome do feriado mais bem colocado; gráfico com a cota guardada do ciclo e a média
  do período juntas; período em abas no balão (B); calendário de um mês com atalhos (A),
  com os atalhos reorganizados; contas em cartões por banco (B); categorias em etiquetas,
  todas à vista, com uma cor fixa de seleção (B); tag com "Mostrar só" ou "Esconder" no topo
  (A); limpar filtros como etiqueta avermelhada com o contador (C com o número da A); tema
  claro com mais contraste (B).
- Contadores: ficam dias de ouro, sequência sem gasto, dentro da cota, a comparação (agora
  com o mesmo ciclo do mês anterior, ciclo 1 contra ciclo 1), dia útil contra não útil com o
  dia da semana mais caro, e a categoria que mais cresceu. Média por dia, maior dia (com o
  maior gasto dele) e projeção do ciclo vão para dentro do gráfico. Gasto em feriados sai.
  Atalhos do calendário, texto do feriado e o gráfico com essas camadas vão para a sexta
  rodada.

- Sexta rodada: nome do feriado num balão com seta acima do dia (A); atalhos do calendário
  em etiquetas acima do mês, com o intervalo e Limpar e Aplicar embaixo (A). Gráfico
  discreto: nada escrito por cima das barras, detalhes só ao passar o mouse ou tocar (o
  total da projeção na área tracejada, o maior gasto no maior dia); a legenda só explica o
  que não se explica sozinho. Títulos dos cartões com "vs" e com o nome de quem paga o
  ciclo, que muda junto quando o nome muda; cartões no tamanho padrão, quatro por linha.
  Destaque do maior dia e o sétimo cartão (dias acima da média) na sétima rodada.

- Sétima rodada aprovada: seis cartões, quatro em cima e dois maiores embaixo. O maior
  dia recebe apenas listras vermelhas discretas dentro da barra. Detalhe acima da barra
  correspondente, por mouse, foco e toque; projeção com título curto e ícones em SVG.
  Não entra um sétimo cartão. Calendário comum também nos formulários de feriado e tag.

## Validações obrigatórias

```json
{"versao": 2, "natureza": "produto", "mudanca": ["logica", "tela", "dado", "migracao"], "aprovacoes": [], "locais": [{"id": "suite", "prova": "suite", "comando": ["uv", "run", "python", "scripts/validar.py", "--e2e"], "limite_s": 900}, {"id": "contraste", "prova": "tela", "comando": ["uv", "run", "python", "scripts/contraste.py"]}], "declaradas": {"regressao": "Pytest de feriados, filtros, cota guardada e simulacao sem gravacao; Vitest de conversao do contrato, calendario e endereco; e2e de navegacao compartilhada, primeiro toque, posicao dos baloes, estilos calculados e formularios com calendario. Revisao independente reproduziu cota legada reaproveitada, categoria/tag ausentes no gasto por conta e estado antigo ao voltar; os novos testes falharam antes e passaram apos a correcao.", "mutacao": "Remover o compartilhamento do filtro fez 1 dos 5 testes falhar; retirar a protecao de cota fez o teste da API falhar com -10 em vez de null. Fontes restauradas em finally, sem manter a mutacao. As mutacoes de feriados da execucao anterior permanecem no registro. Retirar a correspondencia de fim derrubou a regressao de feriado; desligar a atualizacao do rascunho derrubou os testes de Voltar. Arquivos restaurados byte a byte em finally.", "borda": "Cota negativa, zero, filtro e periodo parcial sem contador; simulacao historica nao grava cota; endereco repetido preserva varias selecoes e descarta paginacao; calendario atravessa o ano; datas de tag invertidas impedem salvar. Observacao legada sem fim preservada sem reutilizacao; feriado muda somente o fim; novas observacoes substituem o intervalo; categoria com exclusao de tag pode zerar o gasto por conta.", "diff": "Diff da retomada conferido, trabalho anterior preservado. Conteudo versionavel examinado pelo validador; .env, configuracao local e artefatos visuais confirmados fora do Git. Nenhum dado real copiado nesta retomada.", "tela": "Build 16.3.4 com base ficticia, oito estados em 1366 e 390 px nos dois temas, 32 capturas sem overflow horizontal. Inspecionados Inicio, Movimentos, filtros, feriado e tag; as listras e barras futuras foram corrigidas apos a primeira leitura. Capturas e script temporarios apagados.", "numero": "Base ficticia conferida a mao: 3 de 6 dias de ouro, 57 no total, recorde de 29 dias, 6 de 6 dentro da cota e + R$ 545,50 contra o mesmo ciclo do mes anterior. Media 545,50 / 6 = 90,92. Projecao inclui zeros; teste puro usa 770 de gasto e ritmo 10 por tres dias, total 800.", "ida-e-volta": "c4e8b2d61a90: downgrade para a3c7e9f15b28, upgrade head e current no mercurio_test em 2026-11-06, sem alterar o banco de desenvolvimento. A ida e volta de a3c7e9f15b28 consta da execucao anterior. d5f9c3e72b16: upgrade, downgrade para c4e8b2d61a90 e novo upgrade no mercurio_test, com observacao legada preservada. Coluna aplicada no banco local autorizado, com contagens existentes preservadas."}, "aceitacoes": []}
```

## Riscos

- Feriado por pagador muda as datas do ciclo, e o ciclo alimenta cota, dinheiro livre,
  Movimentos e tags. Hoje o calendário é puro, sem banco; passar os feriados para ele toca
  todos os pontos que chamam `ciclo_de`. Um teste compara os ciclos de 2026 e 2027 antes e
  depois, sem feriado cadastrado, e exige que sejam iguais.
- Feriado cadastrado depois muda ciclo passado: o gasto de um dia pode trocar de ciclo.
  É o comportamento certo, mas mexe em número já visto; o cadastro avisa quando o feriado
  muda um ciclo que já passou.
- Leva grande: se passar de uma página de diferença, os feriados viram leva própria antes
  dos filtros.

## Autorizações necessárias

Migração no banco de desenvolvimento. Commit e push só com pedido.

## Registro da execução

- Conferência de fechamento em 07/11 pelo `fechamento.py --conferir`: suíte completa
  e contraste com código zero, incluindo as cinco specs de planejamento preparadas
  para detalhamento.
- Validação anterior à revisão, vinculada ao índice em 07/11. Passaram 207 Pytest, 94 Vitest
  e 34 Playwright, com uma captura pública opcional ignorada. Ruff, ESLint e build
  aprovados. O e2e registrou duas mensagens de resposta encerrada durante navegação,
  encaminhadas para a revisão independente.
- Migração local autorizada e aplicada em 07/11, de `a3c7e9f15b28` para
  `c4e8b2d61a90`. Revisão e colunas conferidas, com as contagens de contas,
  movimentos, compromissos e recorrências preservadas. A execução seguiu a revisão
  específica pelo Alembic instalado, versão 1.19.1.
- A revisão independente identificou três ajustes. Cota histórica exige início e
  fim correspondentes, gasto por conta precisa receber categoria e tag, e o modo
  de tag e o rascunho de período precisam acompanhar Voltar e Avançar. Os testes
  novos reproduziram as falhas antes das correções.
- A revisão da mensagem de stream encontrou comportamento compatível com cancelamento
  de resposta no Next instalado. Os testes de navegação passaram, e a causa exata
  das conexões encerradas fica qualificada como hipótese.
- Após os três ajustes, a reconferência do diff aprovou as correções por leitura.
  A suíte completa e o contraste passaram novamente, incluindo a navegação real
  de Voltar e Avançar no modo da tag. A migração `d5f9c3e72b16` foi aplicada no
  banco local após a ida e volta no teste, com as contagens existentes preservadas.
- Calendário: `finance_api/ciclo.py` recebe os feriados da cidade por `definir_feriados_locais`
  e continua sem banco; P1 olha só os marcados para quem paga o ciclo 1, P2 os do ciclo 2.
  Feriado que repete vale do ano dele em diante. Os nacionais ganharam nome, para o detalhe.
- Banco: tabela `feriados` (migração `a3c7e9f15b28`), ida e volta no `mercurio_test`. A API
  carrega os feriados ao subir e a cada cadastro; `GET`, `POST` e `DELETE /feriados`, e
  `GET /dias-nao-uteis` para os gráficos. O cadastro devolve `muda_ciclo_passado`, conferido
  nos 12 meses anteriores.
- Prova de que nada mudou sem feriado: os dias de P1 e P2 de 2026 e 2027 calculados com o
  calendário de antes desta leva estão fixos em `test_feriados.py`.
- Filtros na API: `FiltroDeGasto` (várias contas e categorias, só a tag ou sem a tag) em
  `GET /movimentos` e `GET /movimentos/gastos-diarios`, que ganhou também `sem_conta_fixa`.
- Contadores: `finance_api/contadores.py`, lógica pura, e `GET /contadores`. Sequência,
  recorde e total olham o histórico desde o primeiro movimento; a cota só entra quando o
  painel a manda; a comparação só existe quando o período é um ciclo inteiro.
- Página Ajustes com a seção Feriados. Decisões tomadas sem perguntar: Ajustes é o último
  item da navegação; os nacionais aparecem numa frase, não numa lista; no celular, com cinco
  itens, o rótulo da barra de baixo foi para 11 px.
- Mutações: P1 olhando o pagador do ciclo 2 derrubou 4 testes de `test_feriados.py`; "abaixo
  da cota" no lugar de "até a cota" derrubou o teste do limite. Desfeitas, passaram.
- Gráficos: `dias-do-grafico.tsx` é o eixo comum (número, letra do dia, fundo cinza no fim
  de semana e turquesa no feriado), a linha da cota com balão no mouse, foco e toque, e a
  legenda curta. O nome do feriado aparece no detalhe da barra. Tokens `feriado` e
  `feriado-fundo` medidos em `scripts/contraste.py` (5,85:1 no claro, 7,03:1 no escuro); o
  primeiro tom dava 4,54:1 e foi escurecido para ter folga.
- Barra de filtros: `filtro-da-barra.ts` lê e escreve o endereço (`ciclo`, `mes`, `de` e
  `ate`, `conta` e `categoria` repetidos, `com_tag`, `sem_tag`) e serve à página e à barra
  (`barra-de-filtros.tsx`). No Início muda só contadores e gráfico. A barra antiga de
  Movimentos (`filtros.tsx`) saiu.
- Contadores em quatro cartões (`contadores.tsx`). Com o livre negativo a cota também é, e
  "dentro da cota" deixa de contar: o cartão diz que o livre está negativo. Achado ao
  conferir com o dado real, num ciclo que começou estourado.
- Tags: busca, ano e mês, situação e teto no endereço (`filtro-de-tags.ts`).
- Ajustes no desenho A, com edição de feriado (`PUT /feriados/{id}`).
- Defeitos achados pela validação: o cartão apagado por transparência reprovou no contraste
  e virou texto mais fraco; os ciclos do Início vinham da data real e não da data fixa da
  demonstração (os contadores davam "0 de 0" no e2e).
- Fora da leva, pedido no meio dela: a escolha de categoria de um movimento passou ao balão
  que respeita a borda da tela, com e2e do último movimento numa janela baixa; o selo
  "SALDO" saiu do cartão da conta corrente; "Adicionar tag" com maiúscula.
- Correções depois do uso com o dado real: filtrar não leva mais a página ao topo
  (`scroll: false`); o balão escolhe lado, deslocamento e altura uma vez, ao abrir
  (`lado-do-balao.ts`), com a colisão do Radix desligada; zero não leva sinal e -0 vira 0
  (`comSinal` e `moeda` em `formato.ts`), o que corrigia o cofrinho "+ -R$ 0,00"; texto de tela
  com maiúscula inicial; todo cartão diz "Cartão de crédito"; o eixo mostra o nome do feriado
  ou "Fim de semana" ao passar o mouse ou tocar; a cota aparece no canto direito da linha.
- Mutações destas correções: sem `scroll: false` a página pulou 120 px e o e2e falhou; com a
  colisão do Radix ligada o balão desceu ao rolar e o e2e falhou. Desfeitas, passaram.
- Decisões do dono para a rodada seguinte: filtro compartilhado entre Início e Movimentos;
  cota de cada ciclo guardada daqui em diante e, sem ela, a média do período; calendário com
  `react-day-picker`. Mockup da quinta rodada em `rodada-5/` com os dez assuntos.
- Validação histórica, anterior à última troca da barra: 204 Pytest, 87 Vitest e 27 Playwright, contraste sem par abaixo do mínimo.
  Telas conferidas com o dado real em 1366 e 390 px, capturas apagadas depois.

## Lições

- Feriado editável pode mudar só o fim de um ciclo. A observação histórica precisa
  identificar o intervalo completo para que sua cota seja reutilizada com validade.
- A barra de filtros precisa ser conferida em todos os agregados da análise. O
  estado de rascunho também precisa acompanhar a navegação pelo histórico.
- Na revisão pelo celular, rolar o calendário até Aplicar levou o padding junto com o
  conteúdo e os atalhos encostaram na moldura. O espaço da moldura precisa ficar fora da
  região de rolagem. A altura do filtro de período também precisa acomodar o calendário
  quando a janela permite. A regressão confere os controles realmente pintados junto às
  bordas e o primeiro atalho inteiro, depois de rolar, em celular e computador nos dois temas.

- Fixar só o lado preferido do balão do Radix não basta: com a colisão ligada, ele troca de
  lado quando o espaço acaba ao rolar. Desligar a colisão exige refazer a conta que ela fazia
  (deslocamento na horizontal e altura máxima), senão o balão sai da tela no celular.
- Teste de comportamento passa à toa quando o cenário não reproduz o defeito: o primeiro
  teste do balão rolava para o lado errado e passou com e sem a correção. Só a mutação mostrou.
- Importar uma constante de estilo de um módulo com `use client` pode virar uma referência
  de cliente na renderização do servidor, deixando o spread sem os estilos. Vitest não
  reproduz essa fronteira. A inspeção do build revelou barras futuras e listras ausentes;
  o e2e passa a conferir fundo calculado e altura positiva das barras futuras.
- A pasta temporária existente voltou a impedir o Pytest por permissão no Windows. Os
  nove erros eram de preparação da fixture, não de regra financeira; removidos os dois
  caches descartáveis e executada a suíte com acesso adequado, os 207 testes passaram.
- A validação local também apresentou falhas de inicialização de workers, de resolução
  de módulo e de tempo limite ao executar todos os arquivos Vitest em paralelo. A repetição
  usa `VITEST_MAX_WORKERS=2` apenas no ambiente da execução e mantém a suíte inteira.

## Registro do fechamento

Conferido em: 2026-11-07T23:46:46.816413-03:00
Conteúdo validado: sha256:11fb10621ef350be05a3e667af84f4a4cdb6edf6b63fbd0bf2b88b4f65388258
Contrato: sha256:72a0706b3b305bf533efdac8e5cb9e8b16b4394d90af585a545fc51ba5ad5bf6

- A suíte terminou com código 0 pelo comando `["uv", "run", "python", "scripts/validar.py", "--e2e"]`.
- O contraste terminou com código 0 pelo comando `["uv", "run", "python", "scripts/contraste.py"]`.
