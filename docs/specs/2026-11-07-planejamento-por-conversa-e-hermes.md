# Planejamento por conversa e Hermes

Estado: não iniciada
Data: 2026-11-07.

Aprovada para detalhamento. Usa o [Plano do ciclo](2026-11-07-dinheiro-livre-e-plano-do-ciclo.md)
e as [metas](2026-11-07-metas-e-desejos.md). A conexão externa depende de token na API
e autenticação do painel, já previstos na fila do projeto.

## Problema medido

`integrations/hermes-plugin` possui somente README e contrato de ferramentas.
Os pedidos feitos por conversa ainda precisam de um caminho para propor
objetivos e compromissos no domínio financeiro e confirmar sua gravação.

## Resultado esperado

- Interpretar um pedido como proposta estruturada de meta ou despesa futura,
  mostrando valor, data, periodicidade, campos ausentes e efeito no plano.
- A confirmação grava pela mesma regra usada no painel e devolve um resultado verificável.
- Explicar números e sugestões usando os resultados calculados pela API.
- Repetição de mensagem, resposta atrasada e confirmação duplicada preservam um único registro.

## Escopo e dependências

Entra o fluxo de proposta, validação e confirmação, com identidade da operação,
acesso restrito e evidência da alteração. O contrato existente será revisado junto
com a implementação e a versão compatível com o Hermes.

Ficam de fora áudio, leitura de documentos e operações bancárias, que exigem
escopos e autorizações próprios. O canal de conversa será escolhido no detalhamento.

## Decisões para detalhar

1. Quais canais e como identificar, confirmar, corrigir e cancelar cada proposta.
2. Qual papel terá o modelo, qual fornecedor, custo máximo e dados autorizados.
3. Como persistir pedidos incompletos e resolver datas ou valores ambíguos.
4. Quais ferramentas e permissões o contrato do Hermes deve oferecer.

## Como provar

- Pedido fictício de despesa única deve produzir uma ocorrência na data confirmada.
- Cobrir valor ausente, data ambígua, correção antes de confirmar e cancelamento.
- Repetir mensagem e confirmação, simular falha após gravação e verificar a recuperação.
- Conferir recusa de cliente sem permissão, validação de saída malformada e
  limitação de acesso aos dados necessários para a tarefa.
- Conferir que os números explicados correspondem à resposta da API e que a
  indisponibilidade financeira aparece como falha compreensível.

## Práticas consultadas

- seguranca-de-dados-e-agentes e seguranca-de-ia-e-agentes. Recorte de dados, validação de propostas, confirmação e limites de consumo.
- banco-de-dados-e-modelagem, postgres-e-docker e python-ruff-e-pytest. Idempotência e estado consistente após falha.
- navegador-e-formularios e playwright. Prévia e confirmação conferidas na jornada escolhida.

## Fontes consultadas

- [MCP, Tools, versão 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools). Context7 e página oficial consultados, acesso controlado e participação humana.
- [OWASP LLM05:2025](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/). Validar resultados do modelo antes de usá-los no sistema.
- [OWASP LLM02:2025](https://genai.owasp.org/llmrisk/llm022025-sensitive-information-disclosure/). Menor privilégio e transparência sobre o uso dos dados.

## Decisão visual

Pendente. Demonstrar a proposta e sua confirmação no canal escolhido.

## Validações obrigatórias

Contrato preliminar. As provas específicas serão preenchidas antes da implementação.

```json
{
  "versao": 2,
  "natureza": "produto",
  "mudanca": ["logica", "tela", "dado", "integracao", "permissao"],
  "aprovacoes": [],
  "locais": [{"id": "suite", "prova": "suite", "comando": [".venv/Scripts/python.exe", "scripts/validar.py", "--e2e"], "limite_s": 1800}],
  "declaradas": {},
  "aceitacoes": [{"id": "uso", "criterio": "O dono confirma uma proposta no canal escolhido e confere seu efeito no plano"}]
}
```

## Riscos

Conteúdo recebido e saída do modelo exigem validação. A confirmação precisa
identificar a versão da proposta.

## Autorizações necessárias

Serviço externo, custo, compartilhamento de dados, instalação, commit, push e
migração local exigem autorização específica.

## Registro da execução

- Ideia aprovada para detalhamento a partir do contrato existente do Hermes.

## Lições

- A confirmação precisa identificar uma proposta específica e suportar repetição com segurança.
