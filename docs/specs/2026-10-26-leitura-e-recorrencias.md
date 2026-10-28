# Leitura das contas e decisões de recorrência

Estado: concluída
Data: 2026-10-26. Arquivo: `docs/specs/2026-10-26-leitura-e-recorrencias.md`.

O dono usou o Início com o dado real e apontou o que atrapalha a leitura e o que falta
para decidir as recorrências.

## Problema medido

- O selo "Sincronizado há X" é mais baixo que o botão Sincronizar ao lado.
- Contas conectadas em grade única: conta corrente e cartão se alternam, sem título.
- Informação relevante do cartão (limite, disponível, final, vencimento) e das contas
  (entradas e saídas do ciclo) em 10 a 11,5 px, ilegível para o dono.
- O cartão da Nubank chega da Pluggy só como "gold": sem o nome do banco, fica sem logo.
  A bandeira aparece só como texto.
- A tela de Recorrências abre com dois parágrafos de explicação, cards na largura toda e a
  descrição crua da Pluggy ("Transferência enviada|Nome").
- Só existem aprovar e rejeitar. Faltam: recorrência que acabou (uma viagem; Pix que mudou
  de banco), parcelamento com fim (parcelado no cartão de outra pessoa) e a diferença entre
  "acabou" e "nunca foi recorrência".

## Resultado esperado

- Selo e botão com a mesma altura.
- Contas em duas colunas com título: contas correntes de um lado, cartões de crédito do
  outro; no celular, uma depois da outra.
- Nada abaixo de 12 px; o que importa para decidir em 13 a 14 px.
- Cartão com o logo do banco, herdado da conta corrente da mesma conexão, e o logo da
  bandeira.
- Recorrências com cabeçalho curto, ícone de informação no lugar dos parágrafos, cards com
  largura máxima, nome legível e quatro decisões: conta fixa, parcelamento (quantas
  parcelas faltam), encerrada e não é recorrência.
- O Início desconta conta fixa e parcelamento até a última parcela; encerrada não desconta.

## Decisões do dono

- Quatro decisões por recorrência: conta fixa, parcelamento, encerrada, não é recorrência.
  Conta fixa que parar depois também vira encerrada.
- Banco do cartão descoberto pela conexão, automático.
- Recorrência que mudou de banco: a antiga vira encerrada, a nova é decidida na conta nova.

## Escopo

**Entra:** os ajustes de leitura acima; `contas.item_id` com migração; logos das bandeiras
em `apps/web/public/bandeiras`; os estados `parcelamento` e `encerrada` com
`recorrencias.fim_previsto`; o Início considerando os estados novos; a tela de
Recorrências redesenhada conforme o mockup.

**Fica de fora:** caixinha com meta, Contas fixas do mês, projeção e categorias;
reconciliação por identificador externo (leva 2 dos números); navegação de celular.

## Práticas consultadas

- acessibilidade-e-contraste: nada abaixo de 12 px; estado da recorrência escrito no selo,
  não só na cor; abas no padrão de `tablist` com `aria-selected` e painel ligado.
- nextjs-e-react: o banco herdado é calculado na camada de busca (`buscar-resumo.ts`), e o
  componente recebe a conta já pronta.
- banco-de-dados-e-modelagem e postgres-e-docker: migração com ida e volta no banco de teste
  antes do de desenvolvimento.
- playwright: decisão de parcelamento provada contra a API real, no projeto que restaura a
  base a cada tentativa.

## Fontes consultadas

- Simple Icons 16.35.0 (CC0), desenho da marca Visa:
  https://cdn.jsdelivr.net/npm/simple-icons@16.35.0/icons/visa.svg. O site da Visa monta o
  logo por JavaScript, e o da Mastercard recusa o download direto; o símbolo da Mastercard
  foi montado com os dois círculos e as cores da marca.

## Decisão visual

Escolhida a variante A da terceira rodada em `local/mockups/2026-10-26-leitura-e-recorrencias/`,
conferida em 1280 e 390 px:

- Contas correntes e cartões de crédito em duas colunas com título e total; cada linha tem
  uma conta de cada lado e as duas ficam da mesma altura. A conta corrente tem a barra de
  entrou e saiu no ciclo e o saldo do ciclo; sem movimento, "Sem movimento no ciclo".
- Cartão com o logo do banco e o da bandeira; subtítulo com o final do cartão.
- Recorrências em abas: Para decidir (contador vermelho), Contas fixas, Parcelamentos,
  Encerradas e Não é recorrência. Pendente com as quatro decisões em botões; decidida com
  selo colorido do estado, valor em destaque, barra de progresso no parcelamento e "Mudar".
- Recusadas: listas compactas com menu de decisão (rodada 2, decisão escondida), cartões de
  conta com alturas diferentes (rodada 2) e decididas em duas colunas (rodada 3, o valor
  quebrava em duas linhas).
- Quarta rodada, depois de ver o dado real: gráfico do ciclo em colunas com teto (variante
  A): o dia fora da escala é cortado com o valor escrito, e a cota tem rótulo grande.
  Recusado o ritmo acumulado (B): esconde quais dias pesaram. Na mesma rodada: conta
  corrente com Entrou, Saiu e Variação; cartão com "Cartão Gold", número mascarado
  ao lado da bandeira, "fatura atual, vence dia N", selo de percentual do limite e barra
  com limite e disponível; ícones em quadrado colorido; nenhum "·" e texto de 13 px ou mais.

## Como provar

- Conta da mesma conexão sem banco reconhecido mostra o logo do banco da outra conta.
- Parcelamento desconta até a última parcela e some depois; encerrada nunca desconta, e
  seus pagamentos não entram no gasto do dia a dia.
- `PATCH /recorrencias/{id}` aceita os estados novos e `parcelas_restantes`, e recusa
  parcelamento sem parcelas.
- Migração com ida e volta no banco de teste.
- Tela comparada ao mockup em 1280 e 390 px; axe sem violação.

## Validações obrigatórias

```json
{"versao": 2, "natureza": "produto", "mudanca": ["logica", "tela", "dado", "migracao"], "aprovacoes": [], "locais": [{"id": "suite", "prova": "suite", "comando": ["uv", "run", "python", "scripts/validar.py", "--e2e"]}], "declaradas": {"regressao": "testes de parcelamento, encerrada, item_id, banco herdado, duas colunas, abas e decisões escritos junto do código e falhando sem ele", "mutacao": "sem a regra do parcelamento acabado, dois testes falharam; sem encerrada fora do gasto do dia a dia, um falhou", "borda": "parcelamento sem parcelas e parcelas sem parcelamento recusados; parcelamento que acabou; encerrada; coluna sem conta; conta sem movimento no ciclo; descrição sem |; conta desconhecida", "diff": "diff lido; logos com origem registrada; nenhum nome real nem valor do banco real nos arquivos", "tela": "captura do build em 1440 px conferida contra a variante A da terceira rodada e o polimento da quarta, com a base fictícia; celular: não se aplica, a barra lateral fixa deixa 110 px em 390 px e o teste roda com test.fail até a identidade visual", "numero": "fim do parcelamento conferido à mão: última cobrança 05/09 com 4 parcelas termina em 05/01; e2e confere 3 de 6 pagas contra a API real; variação do ciclo conferida contra a mudança do saldo numa conta real, sem registrar valores; teto da escala conferido à mão no teste", "ida-e-volta": "migração b92ad70491e9 aplicada, desfeita e reaplicada no banco de teste"}, "aceitacoes": []}
```

## Riscos

- `item_id` fica nulo até a próxima sincronização; até lá, o cartão "gold" segue sem logo.
- A detecção continua atualizando os números de recorrência encerrada; se a cobrança voltar,
  ela não reabre sozinha.

## Autorizações necessárias

Migração nova (`contas.item_id`, `recorrencias.fim_previsto`) no banco de desenvolvimento.
Commit e push só com pedido.

## Registro da execução

- API: estados `parcelamento` e `encerrada`; `parcelas_restantes` no `PATCH`, recusado sem
  parcelamento e obrigatório com ele; `fim_previsto` = última cobrança vista mais as
  parcelas que faltam, mês a mês; `item_id` gravado na sincronização (`itemId` da conta na
  Pluggy) e devolvido no `/resumo`. Migração `b92ad70491e9`, com ida e volta no banco de
  teste; o downgrade devolve parcelamento e encerrada para pendente.
- Início: parcelamento desconta até a última parcela; encerrada não desconta; pagamentos de
  conta fixa, parcelamento e encerrada ficam fora do gasto do dia a dia.
- Painel: contas correntes e cartões em duas colunas de uma grade só, que iguala a altura da
  linha; conta corrente com barra de entrou e saiu e saldo do ciclo; cartão com logo da
  bandeira e o final no subtítulo; coluna vazia diz "Nenhum cartão conectado" em vez de
  total R$ 0,00 (achado pelo teste de API fora do ar); selo de sincronização com a altura do
  botão; piso de 12 px.
- Recorrências: abas por estado, pendente com as quatro decisões, decidida com selo, valor,
  progresso do parcelamento e "Mudar" (apelido, categoria e as mesmas decisões).
- Mutação: sem a regra do parcelamento acabado, dois testes falharam; sem a encerrada fora do
  gasto do dia a dia, um falhou.
- Validação: 160 Pytest, 51 Vitest e 13 Playwright passando, axe sem violação nas telas.
- Mapa das ideias por tela em `docs/ideias.md`, com gatilho em cadeia na ordem combinada.
- Polimento depois de ver o dado real. Medido no banco de desenvolvimento, só leitura: o
  "saldo do ciclo" de uma conta quase zerada era entradas menos gastos, sem a fatura paga e
  sem a transferência vinda de outra conta do titular; com as duas, a variação fecha com o
  saldo. `GET /movimentos/por-conta` passa a devolver `fatura_paga`,
  `transferencias_entrada` e `transferencias_saida`, e a conta corrente mostra Entrou, Saiu
  e Variação, com a composição no ícone de informação.
- Cartão: "Cartão Gold" no lugar do nome cru, número mascarado ao lado da bandeira, "fatura
  atual" com fechamento e vencimento numa frase, selo de percentual do limite e barra com
  limite e disponível.
- Gráfico do ciclo em colunas com teto (`tetoDaEscala`): quando o maior dia passa de 2,5
  vezes o segundo maior ou a cota, a escala para em 1,25 vez esse valor e o dia cortado
  mostra o valor escrito; cota em selo grande e linha tracejada; dias pulados no celular.
- Sem "·" em texto de tela; piso de 13 px no texto secundário (12 px só no eixo do gráfico e
  no contador da aba); títulos de bloco em 15 px no lugar da caixa alta miúda; ícones em
  quadrado colorido de 34 px.
- Escala reduzida depois de ver no dado real (o dono achou grande demais): número principal
  de 50 para 40 px, valores das contas de 30 para 24 px, títulos de bloco de 15 para 14 px,
  ícones em quadrado de 30 px, cartões com menos respiro e gráfico do ciclo mais baixo. O
  piso de 13 px ficou.
- Validação: 161 Pytest, 54 Vitest e 13 Playwright passando; capturas públicas refeitas com
  a base fictícia e conferidas em 1440 px.

## Lições

- Grade única de duas colunas iguala a altura de cartões vizinhos; duas grades separadas não
  conversam entre si.
- Total de coluna sem item é zero mentiroso: o teste de API fora do ar pegou o "R$ 0,00" da
  coluna de cartões vazia.
- Rótulo que responde a pergunta errada parece número errado: "saldo do ciclo" sem fatura e
  sem transferências próprias não fecha com o saldo, e o dono leu como saída esquecida.
- Corrigir "letra pequena" aumentando tudo passa do ponto: subir só o texto secundário até o
  piso e manter títulos e números perto do tamanho anterior.
