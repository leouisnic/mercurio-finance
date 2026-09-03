# Segurança e dados

## Dados reais nunca entram no repositório

Os dados financeiros reais do Leonardo ficam em
`Documents\Finanças`, fora deste repositório. Essa pasta nunca é
copiada, lida em massa ou anexada ao Git. Desenvolvimento local usa dados
inteiramente fictícios, como os deste repositório.

## Acesso do agente

O agente (Hermes ou Claude) recebe agregados ou transações que o Leonardo
escolher enviar, nunca acesso irrestrito ao banco de dados financeiro. Ver
`integrations/hermes-plugin/contrato.md`.

## Confirmação humana

Pagamento, transferência e emissão ou cancelamento de nota fiscal exigem
confirmação humana explícita antes de executar. Nenhuma ferramenta MCP
planejada executa essas ações sozinha.

## Pluggy e Open Finance

Uso inicial gratuito e somente leitura. Nenhuma credencial de Open Finance
é commitada; fica em variável de ambiente local, fora do Git.

## Portas do Postgres e do Redis só em localhost

`infra/docker-compose.yml` publica as portas do Postgres e do Redis só em
`127.0.0.1`, nunca em `0.0.0.0` ou IPv6. Sem isso, qualquer máquina na
mesma rede (inclusive via Tailscale mais adiante) alcançaria os dois
serviços com as credenciais previsíveis de desenvolvimento definidas em
`infra/.env.example`.

## Segredos e ambiente

- `infra/.env` (a partir de `infra/.env.example`) nunca é commitado.
- AGENTS.md, CLAUDE.md e a memória técnica dos agentes existem localmente,
  são ignorados pelo Git público e têm backup só no `agent-workflow`
  privado do Leonardo.
- Autenticação de usuário, Telegram Bot token e certificado A1 para NFS-e
  ainda não existem nesta entrega; quando forem adicionados, entram por
  variável de ambiente, nunca hardcoded.
