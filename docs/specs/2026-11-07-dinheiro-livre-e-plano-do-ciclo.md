# Dinheiro livre quando estoura e Plano do ciclo

Estado: não iniciada
Data: 2026-11-07.

Rascunho. A prioridade vem de `docs/ideias.md` e dos próximos passos do projeto.
A renda será informada pelo dono, com um atalho de cálculo sugerido. O período
desse cálculo, a proteção do próximo ciclo e a decisão visual aguardam definição.
As ideias foram aprovadas para detalhamento e distribuídas nas specs abaixo.
Cada implementação será preparada com suas regras e decisão visual.

## Mapa das specs

1. Esta spec define o Plano do ciclo, a recomendação de reserva e o efeito na cota.
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
- `entradas_do_dinheiro_livre` lê saldo, cartão, recorrências e compromissos.
  `contas_fixas_pendentes` seleciona as obrigações do ciclo atual. Os modelos e as
  rotas consultados ainda não oferecem cadastro de renda prevista por ciclo ou
  decisão de proteção para o próximo ciclo.

## Resultado esperado

- Regra já aprovada em `docs/ideias.md`. Quando o livre estiver negativo,
  "Hoje dá para gastar" mostra R$ 0 e quanto falta para fechar o ciclo.
  Cota e cofrinho ficam ocultos enquanto durar esse estado.
- O Plano do ciclo apresenta as obrigações previstas para o ciclo seguinte e a
  renda esperada, identificada como previsão. Sugere uma reserva com justificativa
  e mostra sua consequência na cota diária. A política de aplicação aguarda definição.
- A renda prevista participa da projeção do próximo ciclo. Dinheiro disponível
  hoje continua vindo do saldo recebido.

## Decisões registradas

- Renda prevista informada pelo dono, com valor editável e atalho para sugerir
  o resultado de dias trabalhados vezes horas por dia vezes valor por hora,
  menos um abatimento informado. O valor sugerido precisa de confirmação.
- Parâmetros pessoais de remuneração e abatimento ficam no banco local. Os
  exemplos versionados e os mockups usam parâmetros fictícios.
- Direção desejada. O sistema sugere reservas e o efeito na cota diária com
  justificativa, considerando contas futuras e objetivos. IA e entrada pelo
  Hermes são possibilidades a avaliar junto com os limites de acesso aos dados.

## Decisões pendentes

1. Qual recebimento usa o cálculo, qual período trabalhado ele remunera e em
   qual recebimento se aplica o abatimento mensal. A contagem dos dias precisa
   seguir o calendário de trabalho confirmado pelo dono.
2. Aplicação das recomendações. Confirmar uma proposta com impacto na cota ou
   aplicar automaticamente uma política previamente aprovada. A recomendação
   inicial é apresentar a proposta e seu cálculo para confirmação.
3. Prioridades, horizonte e limites da sugestão. Definir a parcela para despesas
   futuras, o espaço para o cotidiano e a contribuição para cada objetivo.
4. Escolher a apresentação em mockup com dados fictícios após o aceite do escopo.
   Persistência, comportamento na virada e relação entre cota e cofrinho serão
   detalhados conforme a política escolhida.

## Escopo

- Entra o estado de livre negativo no Início e o plano do próximo ciclo.
- Entram obrigações avulsas com data explícita. Sua ocorrência respeita a data
  informada, inclusive quando um recebimento é deslocado para outro dia útil.
- A implementação usa as regras de ciclo existentes, as recorrências aprovadas
  e os compromissos ativos, respeitando o término de cada obrigação.
- Fica de fora a matriz anual de Planejamento, prevista em leva própria.
- Ficam de fora importação compartilhada e acertos, definidos na spec de 06/11.
- A conciliação de compromissos com o extrato pertence à leva de Planejamento.

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

## Detalhamento do plano

- Projetar os próximos ciclos por data, incluindo obrigações e estimativas das
  despesas variáveis. A maior falta acumulada indica a cobertura necessária.
  A sugestão respeita a capacidade atual e mostra a parcela ainda descoberta.
- Separar renda recebida, previsão informada e estimativa por histórico. Dados
  ausentes e receitas atrasadas devem aparecer na explicação da recomendação.
- Sugerir reservas e mostrar uma cota ajustada pelo dinheiro restante e pelos
  dias restantes. Definir essa referência junto com a cota-base e o cofrinho
  existentes para manter o significado de cada número compreensível.
- Metas, reservas de longo prazo, revisão mensal e conversa possuem escopo
  próprio nas specs do mapa. O plano deve permitir sua integração posterior.

## Como provar

- O caso reproduzido deve mostrar R$ 0 para hoje e R$ 50 faltantes para o ciclo,
  com cota e cofrinho ocultos. Conferir também a volta ao livre positivo.
- Cobrir o livre zero e distinguir o déficit do ciclo de um disponível diário
  negativo com livre positivo, conforme o comportamento aprovado.
- Conferir a projeção à mão com dados fictícios, renda ausente, renda zero,
  obrigação encerrada, mês curto e mudança de ciclo por feriado.
- Conferir a despesa avulsa no ciclo de sua data, inclusive quando a data de
  pagamento é corrigida. Uma parcela deve produzir uma ocorrência.
- Se houver proteção, comprovar que seu valor afeta o livre uma única vez,
  persiste ao recarregar e é tratado corretamente na virada do ciclo.
- Conferir o contrato entre API e tela, a falha de leitura e a falha de gravação.

## Decisão visual

Pendente. Preparar opções descartáveis no padrão visual existente, com estados
positivo e negativo e leitura adequada no celular.

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

- Obrigações do cartão já podem estar cobertas pelo saldo usado descontado hoje.
  A projeção precisa distinguir essa cobertura para evitar reserva duplicada.
- Projetar a cobrança seguinte exige respeitar a data original e o fim das
  parcelas. A seleção atual de pendências tem horizonte limitado ao ciclo atual.
- Renda desconhecida torna a previsão incompleta. A interface precisa mostrar
  essa ausência, inclusive quando houver obrigações conhecidas.
- Um abatimento já incluído na renda líquida pode aparecer também como conta a
  pagar. Definir a representação desse abatimento evita descontá-lo duas vezes.
- Feriados editáveis podem mudar os limites dos ciclos. A identidade do plano
  precisa ser definida junto com a persistência.

## Autorizações necessárias

Commit, push e eventual migração no banco de desenvolvimento exigem autorização
explícita. A entrega anterior permanece preparada no índice e validada.

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

## Lições

- O déficit diário e o déficit do ciclo podem ter valores diferentes. A mensagem
  sobre fechar o ciclo deve usar o livre do ciclo.
