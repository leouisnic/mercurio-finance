# Reservas e despesas previsíveis

Estado: não iniciada
Data: 2026-11-07.

Aprovada para detalhamento. Reutiliza [Metas e desejos](2026-11-07-metas-e-desejos.md)
e a projeção do [Plano do ciclo](2026-11-07-dinheiro-livre-e-plano-do-ciclo.md).

## Problema medido

Compromissos atuais possuem valor, início, fim e parcelas mensais. A projeção
seleciona pendências do ciclo atual. Despesas sazonais e uma reserva para
imprevistos ainda precisam de contribuição antecipada e acompanhamento próprios.

## Resultado esperado

- Cadastrar uma despesa futura com data e estimativa, sugerindo quanto separar
  em cada recebimento até o vencimento.
- Diferenciar a cobertura de uma obrigação conhecida, a reserva de emergência
  e as metas de consumo, com prioridades compreensíveis.
- Mostrar quanto está coberto, quanto falta e o efeito da contribuição na cota.
- Rever estimativa, prazo e contribuição quando a situação mudar.

## Escopo e dependências

Entra o planejamento de despesas sazonais, estimativas revisáveis e reserva para
imprevistos. O cadastro existente de compromissos atende obrigações avulsas com
uma única parcela ao usar a mesma data inicial e final.

Ficam de fora produtos de investimento e rendimentos, da leva de Investimentos.
A importação de parcelas compartilhadas segue a [spec de acertos](2026-11-06-acertos-e-importacao-compartilhada.md).

## Decisões para detalhar

1. Como sugerir valores para despesas irregulares com histórico suficiente.
2. Como definir a meta e a prioridade da reserva de emergência.
3. Como distribuir contribuições entre ciclos com capacidades diferentes.
4. Como tratar pagamento antecipado, vencimento alterado e uso parcial da reserva.

## Como provar

- Exemplo fictício. Despesa de R$ 1.200, com R$ 400 cobertos e quatro contribuições
  restantes, pede R$ 200 por contribuição antes de limitar pela capacidade.
- Respeitar a data informada para a despesa, inclusive quando o recebimento é
  deslocado por fim de semana ou feriado.
- Cobrir estimativa ausente, custo maior que o previsto e vencimento próximo.
- Quando a conta é paga, conferir o consumo da cobertura e a baixa da obrigação
  para que o total represente corretamente o dinheiro restante.

## Práticas consultadas

- banco-de-dados-e-modelagem, postgres-e-docker e python-ruff-e-pytest. Cobertura por obrigação, centavos e integridade na virada.
- acessibilidade-e-contraste, navegador-e-formularios, nextjs-e-react e playwright. Estimativa identificada e impacto visível no celular.
- seguranca-de-dados-e-agentes. Compromissos reais ficam no banco local, exemplos fictícios.

## Fontes consultadas

- [Banco Central, Caderno de Educação Financeira](https://www.bcb.gov.br/content/cidadaniafinanceira/documentos_cidadania/Cuidando_do_seu_dinheiro_Gestao_de_Financas_Pessoais/caderno_cidadania_financeira.pdf). Despesas sazonais incluídas no orçamento.
- [CVM, Planejamento e gestão de reservas financeiras](https://www.gov.br/investidor/pt-br/penso-logo-invisto/planejamento-e-gestao-de-reservas-financeiras). Meta viável de reserva e revisão periódica.

## Decisão visual

Pendente. Comparar a apresentação das reservas e suas coberturas após definir as regras.

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
  "aceitacoes": [{"id": "uso", "criterio": "O dono confere a cobertura futura e o efeito das contribuições no cotidiano"}]
}
```

## Riscos

Estimativas precisam indicar sua origem. A cobertura já separada pode coincidir
com dinheiro reservado para cartão ou outra meta. Cada destino exige vínculo
verificável.

## Autorizações necessárias

Commit, push e migração local pedem autorização explícita.

## Registro da execução

- Ideia aprovada e separada para detalhamento, apoiada no cadastro atual de compromissos.

## Lições

- O vencimento da obrigação e o recebimento que a financia têm datas próprias.
