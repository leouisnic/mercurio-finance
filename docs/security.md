# Segurança e dados

## Separação de dados

Arquivos financeiros reais ficam fora do repositório. Dados sincronizados pela
Pluggy podem existir apenas no Postgres local de desenvolvimento. Fixtures,
seeds, testes, CI, screenshots públicos e exemplos versionados usam dados
fictícios.

O banco de teste é local, separado do banco de desenvolvimento e tem nome
terminado em `_test`. A suíte recusa outra configuração antes de limpar
tabelas.

## Segredos

Credenciais ficam em `.env` local e nunca são versionadas. Certificados A1,
chaves privadas, tokens e extratos também não entram no Git. Os padrões comuns
de certificados e chaves estão bloqueados no `.gitignore` e no validador de
conteúdo.

## Token da API

A API recusa com 401 toda rota sem `Authorization: Bearer` com o token, menos
`/health`, mesmo escutando só em `127.0.0.1`, e não sobe sem token configurado.
O token fica em `FINANCE_API_TOKEN` no `.env`, fora do Git; o atalho do Mercúrio
gera um na primeira vez (`scripts/token-da-api.ps1`). Só o servidor do painel o
lê, e `api.ts` tem `import "server-only"` para a compilação falhar se um
componente do navegador o importar. Testes e e2e usam tokens fictícios.

Para trocar: apagar o valor de `FINANCE_API_TOKEN` no `.env`, clicar em
"Desligar" no ícone do Mercúrio e abrir pelo atalho de novo, que gera outro.

## Rede

Postgres e Redis publicam portas somente em `127.0.0.1`. As credenciais de
desenvolvimento do Compose não podem ser expostas em interfaces de rede,
inclusive Tailscale.

## Acesso de agentes

Agentes recebem apenas agregados ou transações selecionadas para uma tarefa.
Não recebem acesso irrestrito ao banco real. Screenshots de trabalho são
temporários e devem ser apagados quando sua finalidade terminar.

## Confirmação humana

Pagamento, transferência e emissão ou cancelamento de nota fiscal exigem
confirmação humana explícita. Nenhuma ferramenta MCP atual executa essas ações
autonomamente.

## Contexto privado

`AGENTS.md`, o alias `CLAUDE.md`, a configuração local do Claude e `.workflow/`
existem apenas no ambiente local e possuem backup no `agent-workflow` privado.
O `AGENTS.md` é a única memória privada do projeto.
