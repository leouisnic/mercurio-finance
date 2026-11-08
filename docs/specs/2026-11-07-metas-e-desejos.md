# Metas e desejos

Estado: não iniciada
Data: 2026-11-07.

Aprovada para detalhamento. Depende do plano definido em
[Plano do ciclo](2026-11-07-dinheiro-livre-e-plano-do-ciclo.md).

## Problema medido

O cálculo atual aceita uma caixinha, mas o produto ainda precisa de cadastro de
objetivo, valor já separado, prazo e contribuição por ciclo. Tags agrupam gastos
realizados e possuem teto, enquanto uma meta precisa acompanhar dinheiro guardado.

## Resultado esperado

- Criar um objetivo com valor, prazo opcional, prioridade e progresso.
- Sugerir contribuição por ciclo e apresentar seu efeito no dinheiro livre e
  na cota antes de aplicar o plano.
- Quando a contribuição desejada exceder a capacidade, mostrar a diferença e
  simular ajuste de prazo, valor ou contribuição.
- Rever, pausar e concluir a meta com histórico compreensível de suas alterações.

## Escopo e dependências

Entra o cadastro de metas, o acompanhamento e a simulação no Plano do ciclo.
Aportes, resgates e gastos associados precisam de vínculo explícito para que o
mesmo dinheiro receba um único destino no planejamento.

Fica de fora a contratação de investimentos, tratada na leva de Investimentos.
Entrada por conversa fica na [spec do Hermes](2026-11-07-planejamento-por-conversa-e-hermes.md).

## Decisões para detalhar

1. Como distribuir contribuições entre vários objetivos e as despesas essenciais.
2. Como confirmar o dinheiro efetivamente separado e tratar resgates ou uso parcial.
3. Como calcular o prazo sugerido para metas sem data ou com contribuição insuficiente.
4. Como relacionar uma compra realizada, uma tag e a conclusão da meta.

## Como provar

- Exemplo fictício. Meta de R$ 900, com R$ 300 já separados e seis contribuições
  restantes, pede R$ 100 por contribuição antes de aplicar limites de capacidade.
- Cobrir prazo vencido, meta concluída, ausência de prazo, retirada e várias metas.
- Conferir que reservar, transferir entre contas e realizar a compra produzem
  o efeito financeiro de cada etapa uma única vez.

## Práticas consultadas

- banco-de-dados-e-modelagem e postgres-e-docker. Definir propriedade do saldo e integridade dos vínculos.
- python-ruff-e-pytest. Contas esperadas calculadas à mão e regressões nas fronteiras.
- acessibilidade-e-contraste, navegador-e-formularios, nextjs-e-react e playwright. Prévia do impacto, falhas de gravação e uso no celular.
- seguranca-de-dados-e-agentes. Dados pessoais ficam no banco local, exemplos fictícios.

## Fontes consultadas

- [YNAB, Goal Tracking](https://www.ynab.com/features/goal-tracking). Contribuição por prazo e acompanhamento da meta.

## Decisão visual

Pendente. Comparar opções no padrão existente após detalhar as regras da meta.

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
  "aceitacoes": [{"id": "uso", "criterio": "O dono confere contribuição, progresso e efeito da meta na cota"}]
}
```

## Riscos

Saldo em conta, reserva planejada e valor efetivamente separado precisam de
representação definida. Persistência, reprocessamento e edição concorrente devem
preservar a soma das destinações.

## Autorizações necessárias

Commit, push e migração local pedem autorização explícita.

## Registro da execução

- Ideia aprovada e separada do estudo do Plano do ciclo para detalhamento próprio.

## Lições

- Um teto de gasto e uma meta de dinheiro guardado medem etapas diferentes do objetivo.
