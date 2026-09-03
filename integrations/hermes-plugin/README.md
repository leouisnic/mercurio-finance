# Hermes plugin

Contrato entre o Hermes Agent e o Mercúrio. Nesta etapa existe só a
documentação abaixo. Não há integração ativa, autenticação nem chamada real
ao Hermes Agent.

## Limites de acesso

- O agente recebe agregados (resumos por titularidade, totais por período)
  ou transações específicas que o Leonardo escolher enviar. Nunca tem
  acesso irrestrito ao banco de dados financeiro.
- O agente pode ler e sugerir. Pagamento, transferência, emissão ou
  cancelamento de nota fiscal sempre passam por confirmação humana antes de
  executar.
- Nenhuma credencial, token do Pluggy, certificado ou dado bancário bruto
  trafega para o agente.

## Ferramentas MCP planejadas

Ver [contrato.md](./contrato.md) para a lista de ferramentas MCP previstas
(entrada, saída e se exigem confirmação humana). O contrato é a fonte da
verdade sobre o que o agente pode chamar; a implementação vem em uma etapa
posterior.
