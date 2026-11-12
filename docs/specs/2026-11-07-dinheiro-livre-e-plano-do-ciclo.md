# Dinheiro livre quando estoura e dinheiro guardado

Estado: em andamento
Data: 2026-11-07.

Leva reduzida em 09/11. Quatro mudanças no Início: o livre negativo vira R$ 0 com
a falta do ciclo, uma recomendação de quanto dá para guardar sem apertar o dia a
dia, o dinheiro aplicado reconhecido pela Pluggy como guardado e o resgate
devolvido ao livre. Nada reduz a cota por suposição: só o que aconteceu na conta.
O plano do próximo ciclo (renda prevista, MEI, projeção e reserva automática)
saiu da leva e voltou para `docs/ideias.md`; as regras já decididas ficam em
"Ficou de fora".

## Mapa das specs

1. Esta spec define o livre negativo, a recomendação de quanto guardar e o efeito
   do dinheiro guardado na cota. O plano do próximo ciclo ficou de fora.
2. [Metas e desejos](2026-11-07-metas-e-desejos.md) define objetivos e contribuições.
3. [Reservas e despesas previsíveis](2026-11-07-reservas-e-despesas-previsiveis.md) aplica o planejamento às despesas sazonais e à reserva de emergência.
4. [Revisão mensal e recomendações](2026-11-07-revisao-mensal-e-recomendacoes.md) compara o plano com a execução e sugere ajustes.
5. [Planejamento por conversa e Hermes](2026-11-07-planejamento-por-conversa-e-hermes.md) trata pedidos, propostas e confirmação por conversa.

As dependências de cada spec orientam a preparação. A posição das demais levas
do projeto será considerada ao detalhar cada implementação.


## Problema medido

- Reprodução fictícia em `finance_api.dinheiro_livre.calcular`, sem banco. Ciclo de
  05/10/2026 a 14/10/2026, hoje em 10/10, saldo de R$ 500, cartão usado de R$ 550,
  nenhuma conta fixa e R$ 200 gastos no dia 05. O livre é R$ -50, a cota é R$ 15,
  o cofrinho é R$ -125 e o disponível de hoje é R$ -110. O componente
  `HojeDaParaGastar` exibe esse disponível negativo e mantém cota e cofrinho.
- Aplicação no meio do ciclo, reproduzida no mesmo `calcular` com o mesmo ciclo:
  saldo de R$ 2.000, cartão de R$ 400, R$ 400 gastos no dia 05. Sem aplicação, cota
  R$ 200, cofrinho R$ 600, hoje R$ 800. Com R$ 650 aplicados (saldo R$ 1.350), cota
  R$ 135 no ciclo inteiro, cofrinho R$ 275 e hoje R$ 410: a aplicação é tratada como
  se o dono tivesse gastado demais nos dias que já passaram.
- Histórico real conferido só por totais no banco local, sem gravar em arquivo. Em
  quase todo ciclo o gasto acompanha a renda do próprio ciclo; nos seis meses
  completos mais recentes o gasto passou da renda em média. Aplicações e resgates são
  raros e chegam da Pluggy com a categoria `03`, já tratados como movimentação própria.

## Resultado esperado

- Livre negativo: "Hoje dá para gastar" mostra R$ 0 e quanto falta para fechar o
  ciclo. Cota e cofrinho ficam ocultos enquanto durar esse estado.
- Recomendação, só texto: quanto dá para guardar neste ciclo sem apertar o dia a dia.
  Quando não sobra, o Início diz isso. A cota não muda por causa da recomendação.
- Dinheiro guardado: aplicação vista pela Pluggy aparece como "Guardado neste ciclo",
  fora dos gastos. A cota diminui só do dia da aplicação em diante; o cofrinho dos
  dias que já passaram não muda.
- Resgate: o valor volta para o livre do dia do resgate em diante, sem aviso.

## Decisões registradas

- Nada de reserva automática nem de marca que reduz a cota por previsão. O dono gasta
  a renda de cada ciclo e não quer a cota mexida por suposição.
- A recomendação é só texto. Vale o que a Pluggy mostrar que aconteceu: aplicação
  reduz a cota dali em diante, resgate devolve. Se o dono resgatar, tudo bem.
- Aplicação é a saída de conta corrente com categoria da Pluggy começando em `03`,
  menos rendimento (`03060000`); resgate é a entrada correspondente. É a mesma regra
  de `e_movimento_de_investimento` no worker, que já grava os dois como
  `retirada_titular` e `aporte_titular`.
- Guardar entra na cota "nos dias que faltam" (opção A do mockup de 09/11): o valor
  aplicado sai em partes iguais da cota do dia da aplicação até o fim do ciclo. O
  resgate faz o contrário. É cálculo sobre os movimentos, sem tabela nova: recalcular
  com os mesmos dados dá o mesmo número.
- Quanto dá para guardar: o livre de hoje menos a estimativa do dia a dia vezes os
  dias que faltam, nunca abaixo de zero, arredondado para baixo em R$ 10.
- Estimativa do dia a dia: a mediana das médias por dia (sem contas fixas e fatura)
  dos últimos 6 ciclos completos. Um ciclo atípico, como uma viagem, não puxa o valor.
  Com menos de 2 ciclos completos com dado, não há recomendação e o Início diz por quê.
- Virada do ciclo: o guardado é do ciclo em que foi aplicado. No ciclo novo, só o saldo
  conta; o dinheiro aplicado continua fora da conta corrente até um resgate.

## Decisões pendentes

1. Entrada por NFS-e em estudo, fora desta leva.

## Escopo

- Entra: livre negativo, recomendação de quanto guardar, aplicação e resgate na cota
  e no cofrinho, linha "Guardado neste ciclo" no Início.
- Ficou de fora, com as regras já decididas preservadas abaixo para quando voltar:
  plano do próximo ciclo, renda prevista com atalho por cálculo de trabalho, MEI como
  despesa separada, projeção por data com maior déficit e reserva automática. Motivo:
  cada ciclo é pago pela renda do próprio ciclo e o dono não quer a cota reduzida por
  previsão. Volta como ideia adiada em `docs/ideias.md`, só como aviso.
- Fica de fora a matriz anual de Planejamento, prevista em leva própria.
- Ficam de fora importação compartilhada e acertos, definidos na spec de 06/11.

## Práticas consultadas

- python-ruff-e-pytest. Usar valores esperados calculados à mão e comprovar a
  regressão com o comportamento anterior.
- banco-de-dados-e-modelagem. Definir identidade e integridade da decisão por
  ciclo antes de desenhar a persistência.
- seguranca-de-dados-e-agentes. Exemplos e capturas usam dados fictícios.
- acessibilidade-e-contraste e navegador-e-formularios. Apresentar valor,
  previsão, confirmação e falha de gravação com texto compreensível.
- nextjs-e-react e playwright. Conferir números pela jornada integrada e
  apresentação no build, no celular e no computador.
- postgres-e-docker. Testar eventual migração no banco de teste antes do local.
- windows-e-powershell. Usar o ambiente virtual do projeto e processos ocultos.
- seguranca-de-ia-e-agentes. Validar propostas do modelo, limitar os dados usados
  e calcular valores no serviço de domínio.


## Fontes consultadas

- Regras locais em `docs/domain-rules.md`, `docs/architecture.md`,
  `docs/security.md` e `docs/specs/2026-10-22-dinheiro-livre.md`.
- [CFPB, Creating a cash flow budget](https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_cash_flow_budget_tool_2018-11_ADA.pdf). Sequência de receitas e despesas por data, com saldo levado ao período seguinte.
- [Banco Central, Caderno de Educação Financeira](https://www.bcb.gov.br/content/cidadaniafinanceira/documentos_cidadania/Cuidando_do_seu_dinheiro_Gestao_de_Financas_Pessoais/caderno_cidadania_financeira.pdf). Orçamento, projetos e despesas sazonais previsíveis.
- [YNAB, Goal Tracking](https://www.ynab.com/features/goal-tracking). Contribuição calculada por prazo e progresso da meta.
- [YNAB, Edit Plan](https://support.ynab.com/en_us/plan-and-adjust-with-edit-plan-and-cost-to-be-me-ByR7vpqPyx). Comparação entre custo das metas e renda esperada.
- [CVM, Planejamento e gestão de reservas financeiras](https://www.gov.br/investidor/pt-br/penso-logo-invisto/planejamento-e-gestao-de-reservas-financeiras). Meta de reserva viável, revisão periódica e espaço para qualidade de vida.
- [MCP, Tools, versão 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools). Context7 e página oficial concordam sobre validação, acesso controlado e confirmação humana. Compatibilidade com o Hermes ainda precisa ser conferida.
- [OWASP LLM05:2025](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/). Validação da saída do modelo antes de usar a proposta no sistema.
- [OWASP LLM02:2025](https://genai.owasp.org/llmrisk/llm022025-sensitive-information-disclosure/). Menor privilégio, recorte de dados e transparência sobre seu uso.
- Documentação oficial atual da NFS-e consultada para avaliar uma entrada por arquivo.
  O formato e o leiaute suportados dependem da amostra selecionada.
  [Documentação da NFS-e](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual).
- O XML contém os dados fiscais estruturados da nota e o DANFSe representa esses
  dados visualmente. A escolha do formato de importação será conferida com a amostra.
  [Perguntas e respostas da NFS-e, versão 1.1](https://www.gov.br/nfse/pt-br/perguntas-frequentes/perguntas-e-respostas-nfs-e-v-1-1-20260922.pdf).


## Detalhamento

- `calcular` recebe as aplicações e resgates do ciclo por dia, com sinal (aplicação
  positiva, resgate negativo). O livre do começo do ciclo é reconstruído somando de
  volta o gasto do dia a dia e o guardado líquido. Cada valor `v` aplicado no dia `d`
  reduz a cota de cada dia de `d` até o fim em `v / dias de d até o fim`. O cofrinho
  soma as cotas dos dias anteriores a hoje menos o gasto deles. Soma das cotas do
  ciclo mais nada sobrando: fecha no livre, como hoje.
- Conta à mão, cenário do problema medido com R$ 650 aplicados em 10/10: livre de
  hoje R$ 950, mais R$ 400 de gasto e R$ 650 guardados, dá R$ 2.000 no começo e cota
  base de R$ 200. De 10/10 a 14/10 são 5 dias, então a cota cai R$ 130 e fica R$ 70.
  Cofrinho: 5 dias a R$ 200 menos R$ 400 gastos, R$ 600. Hoje: R$ 670. Os 5 dias a
  R$ 70 mais o cofrinho dão R$ 950, o livre de hoje.
- `entradas_do_dinheiro_livre` passa a ler as aplicações e resgates do ciclo pela
  categoria. Livre negativo usa o livre, não o disponível do dia.
- A API devolve `guardado_no_ciclo`, `da_para_guardar` (ou nulo sem histórico, com o
  motivo) e o estado de livre negativo com a falta. O painel mostra os quatro casos.

## Como provar

- Livre negativo: o caso reproduzido mostra R$ 0 para hoje e R$ 50 faltantes, com
  cota e cofrinho ocultos. Conferir também livre zero e a volta ao positivo.
- Aplicação de R$ 650 em 10/10 no cenário do problema medido: cota R$ 70, cofrinho
  R$ 600, hoje R$ 670. Sem aplicação: R$ 200, R$ 600, R$ 800. Resgate do mesmo valor
  no mesmo dia volta aos números sem aplicação.
- Aplicação no primeiro dia do ciclo equivale a começar o ciclo com o livre menor.
  Aplicação e resgate em dias diferentes; rendimento (`03060000`) não conta como
  guardado; aplicação no cartão não existe e não é lida.
- Recalcular com os mesmos dados dá o mesmo resultado; recarregar a tela também.
- Quanto dá para guardar: com estimativa de R$ 70 por dia, 5 dias e livre de R$ 1.000,
  sugere R$ 650; com livre de R$ 340, sugere zero e o texto de que não sobra; com 1
  ciclo completo de histórico, sem sugestão e com o motivo. Mediana de 6 ciclos com um
  atípico conferida à mão.
- Antes de ligar com dado real: fazer uma aplicação pequena em cada banco conectado e
  conferir, depois da sincronização, que o saldo da conta corrente caiu e o movimento
  chegou com categoria `03`.
- Conferir o contrato entre API e tela e a falha de leitura ("Indisponível", nunca zero).

## Decisão visual

Escolhida pelo dono em 09/11, no mockup `local/mockups/2026-11-07-dinheiro-livre-e-plano-do-ciclo/`.
O cartão "Hoje dá para gastar" tem o mesmo tamanho em todos os casos e não ganha texto
corrido. Abaixo de cota e cofrinho entram dois quadros iguais aos deles: "Guardado no
ciclo", com a data da última aplicação ao lado do valor, e "Dá para guardar", com a
explicação no ícone de informação. Com o livre negativo, o valor fica R$ 0 em vermelho
com a barra cheia, e no lugar de cota e cofrinho entram "Falta para fechar" e "Próximo
pagamento" (data e dias que faltam). A frase de gasto acima do ciclo sai: o valor
negativo em vermelho já diz isso e o cartão não muda de tamanho. Sem histórico, "Dá
para guardar" mostra "Sem histórico". Guardado líquido negativo, quando o resgate é de
dinheiro aplicado em outro ciclo, aparece como R$ 0,00. No celular os quadros ficam um
embaixo do outro, como hoje.

Cor do Guardado conferida em 10/11, a pedido do dono, contra as alternativas. Contraste do
texto sobre o quadro: 6,0:1 no claro e 10,1:1 no escuro (mínimo 4,5:1). Distância em
OKLab até a cor vizinha mais próxima no cartão, com visão comum e simulada (Machado,
severidade 1):

| Candidata | Comum (claro/escuro) | Deuteranopia | Tritanopia | Colide com |
|---|---|---|---|---|
| Verde-água 200 (escolhida) | 0,104 / 0,086 | 0,099 / 0,085 | 0,074 / 0,040 | positivo |
| Azul 235 | 0,130 / 0,092 | 0,108 / 0,064 | 0,075 / 0,025 | marca, positivo |
| Azul 250 | 0,116 / 0,076 | 0,097 / 0,061 | 0,073 / 0,029 | marca, positivo |
| Dourado do cofrinho | 0,134 / 0,122 | 0,010 / 0,072 | 0,108 / 0,094 | alerta |

O verde-água é a mais equilibrada. O dourado, que a identidade reservava para o guardado,
fica igual ao vermelho de alerta para quem tem deuteranopia no tema claro. Nenhuma cor é o
único sinal: rótulo, ícone e sinal de menos dizem o mesmo. Achados que já existiam e ficam
para a revisão da paleta: o dourado do cofrinho e o amarelo de aviso quase não se
distinguem em nenhuma visão (0,006 a 0,029), e no escuro com deuteranopia o verde do
positivo e o vermelho do alerta ficam a 0,024.

## Validações obrigatórias

Contrato preliminar, a completar com as provas específicas do modelo aprovado.

```json
{
  "versao": 2,
  "natureza": "produto",
  "mudanca": ["logica", "tela", "dado"],
  "aprovacoes": [],
  "locais": [
    {
      "id": "suite",
      "prova": "suite",
      "comando": [".venv/Scripts/python.exe", "scripts/validar.py", "--e2e"],
      "limite_s": 1800
    }
  ],
  "declaradas": {},
  "aceitacoes": [
    {"id": "uso", "criterio": "O dono aceita os números e a jornada do plano no Início"}
  ]
}
```


## Riscos

- Se um banco mantiver o dinheiro aplicado dentro do saldo da conta corrente, somar a
  aplicação de volta inflaria o livre. A conferência com aplicação pequena real, antes
  de ligar, mede isso por banco.
- Aplicação que a Pluggy não categorizar como `03` fica parecendo despesa. Aconteceu
  com a reserva do Mercado Pago, resolvida pelo texto (ver Registro de 12/11); o resgate
  da reserva ainda não teve exemplo real para conferir o texto.
- O histórico curto ou com lacunas deixa a recomendação sem base; nesse caso ela some
  com o motivo, em vez de inventar valor.

## Autorizações necessárias

Commit, push e eventual migração no banco de desenvolvimento exigem autorização
explícita.


## Ponto de retomada

- Em 09/11, escopo reduzido com o dono depois de olhar o histórico real por totais.
  Mockup dos quatro casos escolhido e implementado. Validação completa aprovada;
  falta a aplicação pequena real em cada banco e o aceite do dono no Início.
- A entrega anterior está publicada em `2cbc9aa`, com CI aprovada.

## Registro da execução

- 07/11. Inspeção e reprodução da regra atual com valores fictícios.
- 07/11. Rascunho preparado. Decisões de funcionamento solicitadas ao dono.
- 07/11. Escolhida renda editável com sugestão por cálculo de trabalho. Período,
  aplicação do abatimento e proteção do próximo ciclo aguardam esclarecimento.
- 07/11. Estudo de referências e do código atual. A cota reconstrói o começo do
  ciclo, as pendências têm horizonte no ciclo atual e o Hermes possui somente
  contrato documentado. O estudo registra possibilidades para ampliar o plano.
- 07/11. Aritmética fictícia conferida. Livre de R$ 1.000, reserva de R$ 300 e
  contribuição de R$ 100 deixam R$ 600, ou R$ 60 por dia em dez dias restantes.
  Em outro cenário, uma saída de R$ 300 antes de uma receita de R$ 1.000 exige
  cobertura inicial de R$ 300, embora termine com R$ 700 positivos.
- 07/11. Ideias aprovadas para detalhamento e distribuídas em quatro specs
  complementares. A rotina atual de compromissos foi conferida para uma despesa
  avulsa com data corrigida. Dados desse cadastro ficam somente no banco local.
- 08/11. Escolhida aplicação automática de política previamente definida pelo dono.
  Confirmada a necessidade de fontes de renda com base fixa, cálculo por trabalho
  e comissão eventual. Parâmetros pessoais permanecem fora da documentação pública.
- 08/11. Entrada por NFS-e proposta durante o detalhamento. Consultadas as fontes
  oficiais sobre XML e DANFSe. Formato, amostra e posição no escopo permanecem pendentes.
- 08/11. Confirmados mês civil anterior completo como competência, renda bruta
  e MEI separado. Escolhida reserva automática para a falta prevista do próximo ciclo,
  respeitando a capacidade atual depois das obrigações correntes.
- 09/11. Retomada documental validada. Conferidos quatro exemplos fictícios de
  cobertura com Decimal, incluindo falta antes da receita e cobertura parcial.
  Registrada a exigência de recálculo estável e a distinção entre calendário de
  recebimento e trabalho. Orçamento do cotidiano e estimativa de variáveis em decisão.

- 09/11. Decididos cotidiano preservado e variáveis do próximo ciclo pela mesma
  estimativa por dia (mediana dos 6 últimos ciclos, valor do dono sem histórico),
  dias úteis da competência com feriados por pagador, comissão só quando informada
  e recálculo no início do ciclo e nas edições. O dono perguntou se a reserva não é
  só sugestão: registrado que ela é uma marca que reduz a cota, sem mover dinheiro.
  Reserva na cota e virada vão para o mockup.

- 09/11. Mockup explicativo da reserva apresentado; escolhidas reserva nos dias que
  faltam, liberação na virada e cartão de resumo. Em seguida o dono disse que não
  entendia e que gasta toda a renda: o histórico real, só por totais no banco local,
  confirmou. Reserva automática, renda prevista e plano do próximo ciclo saíram da
  leva. Ficou: recomendação só em texto, aplicação e resgate reconhecidos pela Pluggy
  na cota a partir do dia em que acontecem, e o livre negativo.
- 10/11. Implementados livre negativo, guardado pela categoria `03` da Pluggy,
  recomendação pela mediana e o cartão de quatro quadros. `scripts/validar.py --e2e`
  aprovado: Ruff e ESLint limpos, build, 228 Pytest, 100 Vitest e 35 Playwright.
  Cartão conferido na demonstração fictícia no computador, no celular e no escuro.
- 12/11. Aplicação de teste de R$ 1 na reserva do Mercado Pago conferida depois da
  sincronização: a Pluggy a mandou como despesa "Other", com a descrição começando por
  "Dinheiro reservado", e o saldo da conta corrente caiu junto (fechou com os
  movimentos novos). No Nubank o resgate da caixinha vem com a categoria `03`. O
  começo da descrição passou a contar como aplicação no worker e no guardado; depois da
  sincronização a linha virou `retirada_titular` e o ciclo atual mostrou R$ 1,00
  guardado. Mutação: sem a regra no worker ou no guardado, o teste de cada um falha.

## Ficou de fora

Regras decididas para o plano do próximo ciclo, guardadas para quando a ideia voltar.

- Renda prevista informada pelo dono, com valor editável e atalho para sugerir
  o resultado bruto de dias trabalhados vezes horas por dia vezes valor por hora.
  O valor sugerido precisa de confirmação.
- Parâmetros pessoais de remuneração e despesas ficam no banco local. Os
  exemplos versionados e os mockups usam parâmetros fictícios.
- Direção desejada. O sistema sugere reservas e o efeito na cota diária com
  justificativa, considerando contas futuras e objetivos. IA e entrada pelo
  Hermes são possibilidades a avaliar junto com os limites de acesso aos dados.
- Aplicar automaticamente uma política de reserva previamente definida pelo dono.
  A política inicial cobre a falta prevista do próximo ciclo, limitada à capacidade
  atual depois das obrigações do ciclo corrente. Os limites para o cotidiano e os
  gatilhos de recálculo serão definidos antes da implementação.
- A previsão precisa comportar renda calculada pelo trabalho, base mensal fixa
  e comissão eventual informada separadamente.
- A renda calculada por trabalho remunera o mês civil anterior completo ao mês
  de referência do recebimento. Ajustar o dia útil de pagamento preserva essa competência.
- O recebimento é bruto. O MEI é uma despesa mensal própria, associada ao ciclo
  em que é pago, com uma ocorrência. Sua representação deve aproveitar a obrigação
  já cadastrada quando houver uma.
- Cotidiano preservado antes de reservar: a estimativa de gasto do dia a dia por dia
  (sem contas fixas e fatura) vezes os dias que faltam no ciclo atual, ajustável pelo
  dono. Só o livre acima disso pode ir para a reserva.
- Gastos variáveis do próximo ciclo: a mesma estimativa por dia vezes os dias do
  próximo ciclo, sem separar por categoria.
- Origem da estimativa: a mediana das médias por dia dos últimos 6 ciclos completos.
  Um ciclo atípico, como uma viagem, não puxa o valor.
- Sem histórico suficiente (menos de 2 ciclos completos com dado): vale o valor por dia
  informado pelo dono; sem ele, o plano avisa que falta a estimativa e não reserva
  além das obrigações.
- Dias trabalhados na sugestão de renda: segunda a sexta do mês de competência, menos
  os feriados nacionais e os feriados da cidade marcados para aquele pagador em
  Ajustes. O dono confirma ou corrige o número de dias.
- Comissão eventual fica fora da previsão até o dono informar o valor esperado.
- A reserva é recalculada no início do ciclo e quando o dono edita renda, obrigação,
  compromisso ou a estimativa do dia a dia. Com os dados de agora pedindo outra
  reserva, o plano avisa em vez de mudar a cota sozinho.
- A reserva não move dinheiro: é uma marca que reduz a cota. Gastar acima dela não é
  bloqueado; a reserva encolhe e o plano mostra quanto vai faltar no próximo ciclo.

### Contrato do cálculo do plano

- A necessidade de cobertura é o maior déficit acumulado da projeção por data
  do próximo ciclo. Uma sobra no encerramento pode coexistir com falta antes
  da data de uma receita.
- A capacidade disponível para reservar parte do livre atual antes desta reserva,
  respeitando obrigações correntes e o orçamento do cotidiano ainda em definição.
  A previsão de renda futura participa da projeção do próximo ciclo.
- A reserva aplicada é o menor valor entre a necessidade de cobertura e a capacidade
  disponível, ambas limitadas a zero como mínimo. A falta restante é a necessidade
  menos a reserva aplicada.
- Recalcular com os mesmos dados produz o mesmo valor. A reserva já calculada
  deve ser identificada na base usada pelo recálculo para evitar redução repetida.
- A cobertura já descontada pelo uso do cartão participa da conferência de cada
  obrigação. Um pagamento de fatura mantém a mesma cobertura financeira.

Exemplos fictícios com previsão completa. A capacidade informada já considera
as obrigações atuais e o orçamento que será preservado para o cotidiano.

| Projeção do próximo ciclo, na ordem das datas | Capacidade atual | Necessidade | Reserva aplicada | Falta restante |
|---|---:|---:|---:|---:|
| Entram R$ 1.000,00 e saem R$ 1.300,00 | R$ 400,00 | R$ 300,00 | R$ 300,00 | R$ 0,00 |
| Saem R$ 300,00 antes de entrarem R$ 1.000,00 | R$ 400,00 | R$ 300,00 | R$ 300,00 | R$ 0,00 |
| Entram R$ 1.000,00 e saem R$ 1.300,00 | R$ 120,00 | R$ 300,00 | R$ 120,00 | R$ 180,00 |
| Entram R$ 1.000,00 e saem R$ 800,00 | R$ 400,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 |

## Lições

- Este projeto usa só `ruff check`, sem `ruff format`: rodar o formatador reescreve
  dezenas de arquivos fora da leva. Ordenar imports com `ruff check --fix`.
- Recomendação aceita pelo dono sem entender não é decisão. Antes de mockup de
  regra financeira, olhar o histórico real por totais e conferir se a regra cabe
  no jeito como o dono usa o dinheiro.

- O déficit diário e o déficit do ciclo podem ter valores diferentes. A mensagem
  sobre fechar o ciclo deve usar o livre do ciclo.
