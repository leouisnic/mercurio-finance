# Revisão mensal e recomendações

Estado: não iniciada
Data: 2026-11-07.

Aprovada para detalhamento. Usa o [Plano do ciclo](2026-11-07-dinheiro-livre-e-plano-do-ciclo.md),
as [metas](2026-11-07-metas-e-desejos.md) e as [reservas](2026-11-07-reservas-e-despesas-previsiveis.md).

## Problema medido

O produto possui categorias, tags, contadores e comparação de ciclos. Falta uma
revisão que reúna o previsto, o realizado, o progresso das reservas e propostas
com efeito calculado no período seguinte. Planos antigos precisam de referência
própria para que edições posteriores permitam comparação correta.

## Resultado esperado

- Comparar receitas e despesas previstas com as realizadas, por ciclo e por mês.
- Mostrar quanto foi efetivamente guardado, evolução das metas e obrigações encerradas.
- Sugerir ajustes com valor, motivo, período e registros que sustentam a conclusão.
- Simular o efeito do ajuste no próximo plano e registrar sua aceitação ou recusa.

## Escopo e dependências

Entra a revisão por regras e cálculos, com sugestões revisáveis e dados suficientes
para explicar sua origem. Reutiliza os agregados existentes e a próxima
Movimentos redesenhada para as leituras por categoria.

Texto gerado por IA fica na [spec conversacional](2026-11-07-planejamento-por-conversa-e-hermes.md).
Ficam de fora recomendações de produtos financeiros, da leva de Investimentos.

## Decisões para detalhar

1. Qual histórico e qual tratamento de exceções usar para formar uma referência típica.
2. Quando oferecer a revisão e quais avisos merecem aparecer durante o ciclo.
3. Como preservar a versão do plano aceita para comparar com o realizado.
4. Como priorizar sugestões e ajustar o comportamento após uma recusa.

## Como provar

- Exemplo fictício. Gasto previsto de R$ 400 e realizado de R$ 460 produz excesso
  de R$ 60, com os mesmos movimentos e exclusões usados no restante do produto.
- Cobrir histórico curto, ciclo incompleto, período sem receita e movimentos pendentes.
- Comparar transferências próprias, aporte de reserva e gasto efetivo conforme
  as regras de domínio, com cada etapa contada uma única vez.
- Conferir que a evidência de cada sugestão reproduz seu valor e que uma nova
  versão do plano preserva a leitura do período fechado.

## Práticas consultadas

- banco-de-dados-e-modelagem, postgres-e-docker e python-ruff-e-pytest. Plano aceito identificável, agregação consistente e contas manuais.
- acessibilidade-e-contraste, navegador-e-formularios, nextjs-e-react e playwright. Comparação compreensível, estado incompleto e falha visível.
- seguranca-de-dados-e-agentes. Exemplos fictícios e evidências financeiras mantidas no banco local.

## Fontes consultadas

- [Banco Central, Caderno de Educação Financeira](https://www.bcb.gov.br/content/cidadaniafinanceira/documentos_cidadania/Cuidando_do_seu_dinheiro_Gestao_de_Financas_Pessoais/caderno_cidadania_financeira.pdf). Planejar, registrar e acompanhar o orçamento.
- [YNAB, Edit Plan](https://support.ynab.com/en_us/plan-and-adjust-with-edit-plan-and-cost-to-be-me-ByR7vpqPyx). Comparar o custo do plano com a renda esperada.

## Decisão visual

Pendente. Comparar leituras de revisão mensal após definir os indicadores.

## Validações obrigatórias

Contrato preliminar. As provas específicas serão preenchidas antes da implementação.

```json
{
  "versao": 2,
  "natureza": "produto",
  "mudanca": ["logica", "tela", "dado"],
  "aprovacoes": [],
  "locais": [{"id": "suite", "prova": "suite", "comando": [".venv/Scripts/python.exe", "scripts/validar.py", "--e2e"], "limite_s": 1800}],
  "declaradas": {},
  "aceitacoes": [{"id": "uso", "criterio": "O dono confere a revisão e entende o motivo e o impacto das sugestões"}]
}
```

## Riscos

Histórico incompleto ou não classificado pode distorcer recomendações. Sugestões
precisam declarar a suficiência dos dados e respeitar as decisões sobre prioridades.

## Autorizações necessárias

Commit, push e migração local pedem autorização explícita.

## Registro da execução

- Ideia aprovada e delimitada para detalhamento, aproveitando a análise já prevista em Movimentos.

## Lições

- Avaliar a execução de um plano exige conhecer a versão que foi aceita naquele período.
