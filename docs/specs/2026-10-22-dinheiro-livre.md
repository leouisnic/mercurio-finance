# Dinheiro livre até o próximo recebimento

Estado: concluída
Data: 2026-10-22. Arquivo: `docs/specs/2026-10-22-dinheiro-livre.md`.

Primeira leva das páginas e indicadores escolhidos com o dono. A Visão geral passa a abrir
respondendo quanto dá para gastar até o próximo pagamento. As páginas novas (Contas fixas do
mês, Projeção do ciclo e Gastos por categoria) vêm nas levas seguintes, cada uma com mockup.

## Problema medido

- Os indicadores da Visão geral (saldo em conta, usado no cartão, disponível no cartão)
  nasceram com o código e nunca foram escolhidos. Nenhum deles diz se dá para gastar.
- A planilha que o dono usa calcula valor livre e limite diário; o Mercúrio não calcula
  nenhum dos dois.
- A base fictícia tem movimentos de agosto de 2026. Em qualquer outro mês o ciclo corrente
  aparece zerado na demonstração.
- Sem cartão conectado, a tela mostra "R$ 0,00 de R$ 0,00 de limite" em vez de dizer que não
  há cartão.

## Resultado esperado

O topo da Visão geral mostra o dinheiro livre até a véspera do próximo pagamento e o valor
por dia, com a conta aberta, item por item:

```
livre = saldo das contas correntes
      - tudo que está usado nos cartões
      - contas fixas com cobrança prevista até a véspera do pagamento e ainda não pagas
      - aporte do ciclo para a caixinha com meta (leva 2; sem meta, zero)
cota do dia = livre / dias do ciclo, recalculada só quando entra dinheiro ou surge conta fixa
cofrinho = soma, nos dias anteriores do ciclo, de (cota do dia - gasto do dia)
hoje dá para gastar = cota do dia + cofrinho - gasto de hoje
```

Exemplo fictício conferido à mão: saldo R$ 3.152,90, cartão R$ 640,30, contas fixas
R$ 188,90, caixinha R$ 380,00; livre R$ 1.943,70. Ciclo de 10 dias com cota de R$ 268,74 e
gastos de R$ 743,70 nos 5 primeiros: cofrinho R$ 600,00, hoje R$ 868,74, e
5 x 268,74 + 600,00 = 1.943,70, igual ao livre.

## Decisões do dono

- Pergunta da tela inicial: quanto posso gastar até receber.
- Cartão: sai do livre tudo que já está usado, desde a compra; o pagamento da fatura não
  desconta de novo, porque já sai das despesas.
- Contas fixas: as que vencem antes de receber e ainda não apareceram no extrato; recorrências
  aprovadas e compromissos.
- Reserva: caixinha com meta. O Mercúrio sugere o aporte do ciclo, avisa quando o ciclo
  não comporta e detecta o que foi guardado pela transferência. No Início só o aporte do
  ciclo sai do livre. Substitui o percentual de 10% decidido antes. Leva 2.
- Por dia: cota fixa com cofrinho. A sobra do dia acumula e aparece somada em "hoje dá
  para gastar"; gasto acima da cota deixa o cofrinho negativo.
- Guardar na caixinha não é gasto: movimentos de categoria `03` (Investments) passam a ser
  movimentação entre contas próprias, e os já gravados são reclassificados nesta leva.
- Cota reconstruída: o Mercúrio guarda só o saldo atual, então a cota é
  (livre de hoje + gasto do dia a dia já feito no ciclo) / dias do ciclo. Entrada extra no
  meio do ciclo se espalha por todos os dias dele, inclusive os passados. Sem foto diária
  de saldo.
- Conta fixa prevista e não vista no extrato continua descontada, marcada como atrasada,
  até aparecer ou o ciclo acabar.
- A demonstração e o e2e fixam a data em 10/08/2026 (`MERCURIO_HOJE`) em vez de deslocar a
  base fictícia, que tem datas fixas usadas pelos testes. Substitui a "base fictícia
  acompanhando a data de hoje".
- Dias de pagamento 5 e 15 continuam fixos em `ciclo.py`; viram ajuste quando forem
  precisar mudar. Decisão sem efeito no resultado de hoje.
- Sem frase explicativa solta na tela: cada número tem um ícone de informação com
  descrição curta e objetiva.
- Cores: reserva dourada; cofrinho no azul da marca.
- Nome dos ciclos: pelo nome de quem paga cada um, configurado localmente e nunca no
  código, porque o repositório é público; a demonstração usa "Empresa A" e "Empresa B".
- Contar só saldo recebido: renda prevista não entra no livre.
- Primeira rodada de mockup: a barra da composição (B) com o "hoje dá para gastar" (C).
  Recusada a conta em linhas da A como destaque: o dono quer ver proporção e o dia.
- Cores: cartão e contas fixas em vermelho, porque são gasto; reserva numa cor de
  investimento, nunca de gasto.
- Páginas: Início (livre, hoje, contas), Movimentos (passado: extrato, categorias,
  comparação de ciclos), Planejamento (futuro: contas fixas do mês, projeção, reserva) e
  Ajustes (cadastros: recorrências, compromissos, nomes das contas).
- Logo real de cada banco no card. A Pluggy não serve: as duas conexões passam pelo
  MeuPluggy, e o `connector.imageUrl` é o ícone dele, medido em 2026-10-22.
- Segunda rodada: escolhida a C (cofrinho, reserva dourada), com a ressalva de que
  cofrinho e reserva não podem dividir cor, porque um é avaliação diária e o outro é
  dinheiro guardado. Recusada a B: sem cofrinho, a sobra some.

## Escopo

**Entra:** reclassificar aplicação e resgate (categoria `03`) como movimentação entre
contas próprias, no mapeamento e nos 24 movimentos já gravados; previsão do vencimento de
cada conta fixa; o cálculo na API, item por item, com cota e cofrinho; a página Início
conforme o mockup; o logo de cada banco; as descrições por número; a data fixa da
demonstração; o indicador de cartão sem cartão conectado.

**Fica de fora:** a caixinha com meta (leva 2); Contas fixas do mês, projeção e
categorias (leva 3); dias de pagamento configuráveis; navegação de celular (identidade
visual).

## Práticas consultadas

- nextjs-e-react: só a camada de acesso lê `process.env`; nomes dos pagadores e data fixa
  ficam no servidor, e o componente de cliente recebe só os números.
- acessibilidade-e-contraste: cor nunca é o único sinal (legenda com rótulo e valor, conta
  atrasada escrita); elemento nativo antes de ARIA (`<button>` no ícone de informação).
- navegador-e-formularios: converter JSON não valida a resposta; a busca converte campo a
  campo.
- banco-de-dados-e-modelagem e postgres-e-docker: migração de dado com ida e volta no banco
  de teste antes do de desenvolvimento.
- playwright: provar contra a API real e esperar o estado novo.

## Fontes consultadas

- Pluggy, árvore de categorias: https://docs.pluggy.ai/docs/transaction-categories e
  `GET /categories` (família `03`, rendimento `03060000`).
- Pluggy, transações: https://docs.pluggy.ai/docs/transactions.
- Radix, Tooltip no pacote `radix-ui`: https://www.radix-ui.com/primitives/docs/components/tooltip
  (Provider, Root controlado, Trigger com `asChild`).
- Recharts 3: https://github.com/recharts/recharts (BarChart, Cell, ReferenceLine,
  ResponsiveContainer, `accessibilityLayer`).
- MDN, `FormData(form, submitter)`: https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData.

## Decisão visual

Escolhida a variante A da quarta rodada em `local/mockups/2026-10-22-dinheiro-livre/`, conferida
em 1280 e 390 px:

- Linha do tempo no topo: ciclo atual com o avanço até hoje, ciclo seguinte e os três
  pagamentos marcados com o nome de quem paga; no celular, só as datas nos marcos e os
  ciclos numa legenda.
- "Hoje dá para gastar" como número destaque, com medidor do gasto de hoje e dois cartões
  com ícone, cota do dia e cofrinho.
- Ao lado, a barra do saldo (cartão e contas fixas em vermelho, caixinha dourada, livre
  verde) e as próximas contas fixas com a data; até 3, e uma linha "+ N contas, ver todas"
  quando houver mais, para o cartão não crescer.
- Embaixo, gráfico de colunas do gasto por dia contra a cota tracejada; o dia acima da cota
  em vermelho, os próximos pontilhados, valor ao passar o mouse.
- Contas conectadas com o logo do banco.
- Recusadas: a conta em linhas como destaque (rodada 1), a sobra espalhada (rodada 2), o
  cofrinho verde (rodada 3, parecido com o livre) e a fileira de quatro cartões sem gráfico
  (rodada 4, não mostra o ritmo do ciclo).

## Como provar

- Conta à mão do exemplo fictício batendo com a API e com a tela.
- Conta fixa já paga no ciclo não desconta; a que vence depois do pagamento não desconta.
- Pagamento de fatura no extrato não reduz o livre duas vezes.
- Sem pagamento no ciclo, a reserva é zero; sem cartão, o cartão é zero e a tela diz isso.
- Livre negativo aparece como negativo, com aviso, e o valor por dia não vira positivo.
- API fora: o bloco fica indisponível, nunca zero.

## Validações obrigatórias

```json
{"versao": 2, "natureza": "produto", "mudanca": ["logica", "tela", "dado", "migracao"], "aprovacoes": [], "locais": [{"id": "suite", "prova": "suite", "comando": ["uv", "run", "python", "scripts/validar.py", "--e2e"]}], "declaradas": {"regressao": "testes do mapeamento de investimento falharam antes da regra e passam; teste da rota /dinheiro-livre e os 13 do cálculo escritos com a conta à mão antes do código final", "mutacao": "sem a exclusão de conta fixa no gasto do dia a dia, o teste da rota falhou; sem o gasto de hoje na reconstrução da cota, o teste de gastar hoje falhou", "borda": "gasto de hoje, cofrinho negativo, primeiro dia do ciclo, livre negativo, conta fixa paga no ciclo, atrasada, parada, depois do pagamento, compromisso antes de hoje, sem cartão, mais de três contas fixas, rendimento fora da reclassificação, API fora do ar no Início", "diff": "diff lido antes do commit; nomes reais dos pagadores fora do repositório; spec sem valor do banco real", "tela": "computador: captura do build em 1440 px igual à variante A da quarta rodada, com a base fictícia, e o dono viu com o dado real. Celular: não se aplica, a barra lateral fixa deixa 110 px em 390 px e o teste roda com test.fail até a identidade visual", "numero": "base fictícia em 10/08/2026 conferida à mão: cota 308,20, cofrinho 1.060,50, hoje 1.303,70, e 1.303,70 + 6 x 308,20 = 3.152,90; teste da rota com 2.323,70, 306,74 e 790,00", "ida-e-volta": "migração e343dbf6fb03 no banco de teste: upgrade reclassifica aplicação e resgate e mantém rendimento, sincronização seguinte com 0 linhas novas, downgrade devolve os tipos"}, "aceitacoes": []}
```

## Riscos

- Saber se uma conta fixa "já foi paga" depende de casar a recorrência com um movimento do
  ciclo; casamento errado desconta duas vezes ou esquece uma conta.
- O saldo do cartão que a Pluggy manda é o usado do limite; se incluir parcelas futuras, o
  livre fica menor que o real. Conferir no dado real antes de fechar.

## Autorizações necessárias

Reclassificar os 24 movimentos de categoria `03` no banco de desenvolvimento, com contagem
antes e depois, aprovada pelo dono em 2026-10-22. Commit e push só com pedido.

## Registro da execução

- Família `03` da Pluggy conferida em `GET /categories` e em
  https://docs.pluggy.ai/docs/transaction-categories: `03060000` é rendimento ("Proceeds
  interests and dividends") e continua receita; o resto da família vira movimentação entre
  contas próprias em `mapear_para_movimento`. Testes do mapeamento falharam antes da regra.
- Achado: o tipo entra no fingerprint. Trocar só o tipo dos movimentos gravados faria a
  sincronização seguinte duplicar cada um. A migração `e343dbf6fb03` recalcula o fingerprint
  com `mercurio_domain.fingerprint` e limpa a marca de fatura, que só vale para despesa.
- Ida e volta no banco de teste com dado fictício: aplicação e resgate reclassificados,
  rendimento intacto, sincronização seguinte com 0 linhas novas, downgrade devolvendo os tipos.
- Banco de desenvolvimento, em 2026-10-22: 16 aplicações (2 delas marcadas como fatura) e 8
  resgates reclassificados; 17 rendimentos intactos; total de movimentos igual antes e depois;
  nenhuma recorrência pendente vinha de aplicação.
- Cálculo em `finance_api.dinheiro_livre`, lógica pura, e rota `GET /dinheiro-livre?hoje=`.
  Treze testes do cálculo com a conta da spec feita à mão e as bordas (gasto de hoje,
  cofrinho negativo, primeiro dia, livre negativo, conta fixa paga, atrasada, parada,
  compromisso). Teste da rota com pagamento de fatura e conta fixa paga excluídos do dia a
  dia: livre 2.323,70, cota 306,74, cofrinho 790,00. Uma conta minha de cabeça saiu
  2.323,60; o cálculo em Python corrigiu antes de virar teste.
- Base fictícia em 10/08/2026, conferida à mão contra a API: cota (3.152,90 + 545,50) / 12
  = 308,20; cofrinho 5 x 308,20 - 480,50 = 1.060,50; hoje 1.303,70; e
  1.303,70 + 6 x 308,20 = 3.152,90.
- Tela: linha do tempo, "hoje dá para gastar", composição do saldo com até 3 contas fixas
  e o resto somado, gráfico do ciclo com tabela equivalente para leitor de tela, logos em
  `public/bancos`. A fileira antiga de indicadores saiu, e com ela o "R$ 0,00 de R$ 0,00".
- Logos: o do Mercado Pago baixado do ícone oficial do site para pasta isolada, lido antes
  de usar (sem script, evento ou link externo); o do Nubank montado do SVG oficial do
  cabeçalho do site.
- Achado do axe: `aria-hidden-focus` no gráfico, porque a camada de teclado do Recharts 3
  torna o SVG focável. Desligada (`accessibilityLayer={false}`); a tabela é o equivalente.
- Bibliotecas com versão fixa e publicada havia pelo menos duas semanas: lucide-react
  1.53.0, radix-ui 1.7.0, recharts 3.10.1, react-is 19.2.8. O `npm audit` acusa o Next
  16.3.4 e duas dependências dele, iguais antes da instalação.
- `apps/web/.env.local` com os nomes reais foi recusado pela trava de escopo, que não
  deixa conteúdo de `.env` passar pela conversa; o dono cria o arquivo.
- Validação em 2026-10-26: `scripts/validar.py --e2e` verde, com Ruff, 153 Pytest, 52
  Vitest, build e 13 Playwright (inclui os números da tela contra a API real, o balão de
  informação e o axe nas três telas). O servidor do Next registrou "destination stream
  closed early" quando o e2e de renomear recarrega a página durante a resposta da action;
  o teste passa.
- Capturas públicas de `docs/telas` regeneradas com a base fictícia.
- Dado real: estava parado desde 09/09. Ao subir o worker, ele executou três sincronizações
  que esperavam na fila desde cliques anteriores em Sincronizar, inclusive na demonstração,
  que divide a fila com o painel real. Lição registrada abaixo.
- Na sincronização, a Pluggy recategorizou um pagamento de fatura de "Investments" para
  "Credit card payment". O tipo mudou, o fingerprint mudou, e a transação ganhou uma segunda
  linha com o mesmo identificador externo. Nenhuma das duas conta como gasto. Aconteceria
  igual sem a migração: é a fragilidade de R3 e R4, que fica para a leva 2 dos números.
- No dado real, sem recorrência aprovada, Pix do dia do pagamento contam como gasto do dia a
  dia e deixam o cofrinho muito negativo. A regra está certa; falta o dono dizer o que é
  conta fixa.

## Lições

- A fila do Redis é uma só para a demonstração e o painel real, e o job grava no banco do
  worker, não no da API que enfileirou. Subir o worker executa tudo que estava esperando.
  Antes de subir, olhar a fila.
- O fingerprint inclui o tipo, então qualquer recategorização da Pluggy gera linha nova com o
  mesmo identificador externo. Reclassificar à mão exige recalcular o fingerprint, e a
  reconciliação por identificador é a leva 2.
