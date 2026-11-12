# Senha do painel

Estado: em andamento
Data: 2026-11-12. Arquivo: `docs/specs/2026-11-12-senha-do-painel.md`.

O painel escuta só em 127.0.0.1 porque não tinha senha (P04 de `docs/spec.md`). Esta leva
põe a senha e abre o painel aos aparelhos do dono pelo Tailscale. O I02 da concepção já
decidiu a sessão por cookie httpOnly com expiração e sem segundo fator. A API já exige
token (`2026-11-10-token-na-api.md`).

## Problema medido

- Sem senha, o painel não pode sair desta máquina: abrir a porta exporia o extrato a
  quem alcançasse o endereço (P04, M05).
- O layout raiz (`apps/web/src/app/layout.tsx`) desenha a barra lateral e chama a API em
  toda página; uma tela de entrada herdaria as duas coisas.
- Toda leitura e ação do painel passa por `chamarApi` (`apps/web/src/app/api.ts`), lido
  no código: é o ponto único para conferir a sessão.

## Resultado esperado

- Sem sessão, toda página leva para `/entrar`; nenhuma leitura nem ação chega à API.
- Na tela de entrada, a senha certa abre o painel por 30 dias naquele aparelho; a
  errada mostra "Senha incorreta."; depois de 5 erros, espera de 15 minutos.
- Sair encerra a sessão do aparelho e volta para `/entrar`.
- Pelo Tailscale, o celular do dono abre o painel por HTTPS, de qualquer lugar; nada
  abre na rede local.

## Decisões

- Do dono, em 12/11: esta é a próxima leva; acesso pelo Tailscale; sessão de 30 dias com
  botão Sair; tela de entrada com cartão no centro; Sair junto do seletor de tema.
- Da concepção: I02 (cookie httpOnly, expiração, sem segundo fator) e P04.
- `tailscale serve --bg 3001`: o painel continua em 127.0.0.1 e o Tailscale entrega
  HTTPS com certificado aos aparelhos da conta do dono. Instalar o Tailscale, criar a
  conta e entrar nos aparelhos é do dono; o comando é passo único documentado.
- Senha guardada como hash scrypt (`node:crypto`) em `PAINEL_SENHA_HASH` no `.env`. Quem
  digita é o dono, num script com entrada oculta (`apps/web/scripts/definir-senha.mjs`).
- Sessão sem tabela: cookie assinado com HMAC-SHA256 por `PAINEL_SEGREDO_DA_SESSAO`,
  gerado como o token da API; httpOnly, SameSite=Lax, Secure quando a requisição chega
  por HTTPS. Sair de todos os aparelhos é trocar o segredo.
- `chamarApi` confere a sessão antes de chamar a API; o `proxy.ts` do Next 16 redireciona
  para `/entrar`. A documentação do Next manda conferir dentro das ações do servidor,
  não só no proxy, e o ponto único cobre as duas.
- Sem sessão, o layout desenha só a moldura, sem barra lateral e sem chamar a API.
- Tentativas contadas em memória do processo: reiniciar o painel zera, aceitável com o
  painel atrás do Tailscale.

## Escopo

- Entra: senha, sessão, tela de entrada, Sair, proxy, ponto único em `chamarApi`,
  scripts de senha e segredo, atalho, Tailscale documentado.
- Fica de fora: troca de senha pela tela (é o script), segundo fator, lista de aparelhos
  conectados, bot do Telegram.

## Práticas consultadas

- seguranca-de-dados-e-agentes: segredo e hash só no `.env`; senha nunca em log, teste ou
  commit; senha real digitada só pelo dono.
- nextjs-e-react: `proxy.ts` do Next 16 e `server-only` no módulo da sessão.
- navegador-e-formularios: campo com rótulo, `autocomplete="current-password"`, erro
  legível, botão desligado durante a espera.
- acessibilidade-e-contraste: foco visível, mensagem com `role="alert"`, contraste dos
  pares já medidos.
- playwright: projeto de entrada que grava o estado e os outros dependem dele.
- windows-e-powershell: segredo gerado pelo mesmo script do token.
- identidade-visual: marca já aprovada na tela de entrada, sem cor nova.
- banco-de-dados-e-modelagem, postgres-e-docker, infraestrutura-e-nuvem: não se aplicam,
  sem tabela, banco ou nuvem novos.

## Fontes consultadas

- [Tailscale Serve](https://tailscale.com/kb/1312/serve): `tailscale serve <porta>` leva o
  tráfego da tailnet para o serviço local, com HTTPS; o serviço pode escutar só em localhost.
- [Next.js, proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy):
  `middleware` virou `proxy` no Next 16, roda em Node e as ações do servidor precisam
  conferir a autenticação por conta própria.

## Decisão visual

Escolhida pelo dono em 12/11, no mockup `local/mockups/2026-11-12-senha-do-painel/`:
opção A da entrada, cartão no centro com a marca, o campo de senha com "Mostrar", Entrar e
a linha "Este aparelho fica conectado por 30 dias."; erro em faixa de alerta e espera em
faixa de aviso, com o botão desligado. Opção A do Sair: embaixo da barra lateral, junto
do tema, no computador; ícone no topo, ao lado do tema, no celular.

## Como provar

- Vitest: cookie válido, expirado, adulterado e com segredo trocado; senha certa e errada;
  bloqueio na sexta tentativa e liberação depois da espera; `chamarApi` sem sessão não
  chama a API.
- e2e: projeto de entrada com senha fictícia; página sem sessão vai para `/entrar`; senha
  errada mostra o erro; Sair volta para `/entrar`.
- Compilação: hash, segredo e senha fictícios ausentes do que vai ao navegador.
- Real: pelo celular no Tailscale, a senha abre o painel, uma ação funciona, e sem sessão
  nada chega à API.

## Validações obrigatórias

```json
{
  "versao": 2,
  "natureza": "produto",
  "mudanca": ["logica", "tela", "permissao"],
  "aprovacoes": [],
  "locais": [
    {"id": "suite", "prova": "suite", "comando": [".venv/Scripts/python.exe", "scripts/validar.py", "--e2e"], "limite_s": 1800}
  ],
  "declaradas": {},
  "aceitacoes": [
    {"id": "uso", "criterio": "O dono entra pelo celular no Tailscale com a senha e usa o painel"}
  ]
}
```

## Riscos

- Ações do servidor atrás do `tailscale serve`: o Next compara `Origin` e `Host`; se o
  proxy do Tailscale mudar o `Host`, as ações falham. Medir e, se preciso, permitir a
  origem `ts.net` da máquina.
- Esquecer a senha: o script define outra; o painel não tem recuperação por e-mail.

## Autorizações necessárias

Commit e push pedem autorização. Senha real é digitada só pelo dono. Instalação do
Tailscale e criação da conta são do dono.

## Ponto de retomada

- Implementado e validado com dados fictícios. Falta, com o dono: definir a senha
  real pelo script, autorizar `tailscale serve --bg 3001` (a conta ainda não tem os
  certificados HTTPS ligados), abrir pelo atalho e entrar pelo celular, conferindo
  que as ações do servidor funcionam atrás do Tailscale.
- O `.env` local tem uma linha antiga `PAINEL_SENHA` com senha em texto, que nenhum
  código lê; sai depois que o hash for definido.

## Registro da execução

- 12/11. Decisões do dono, documentação do Tailscale e do Next 16 conferidas, mockup
  escolhido.
- 12/11. Implementados `sessao.ts`, `proxy.ts`, `/entrar`, Sair, barreira em
  `chamarApi`, layout sem sessão, `definir-senha.mjs` e `segredo-do-env.ps1` (o antigo
  `token-da-api.ps1`, agora com `-Nome` e `-SomenteLer`). Vitest: 13 testes de sessão,
  senha, tentativas e `chamarApi`; desligar a barreira do `chamarApi` faz 2 falharem.
  e2e: projeto de entrada que grava a sessão e três testes de entrada e saída.
- 12/11. `scripts/validar.py --e2e` aprovado: Ruff e ESLint limpos, build, 309 Pytest,
  113 Vitest e 39 Playwright. Senha e segredo fictícios ausentes de `static` e de
  `server` no build. Telas conferidas na demonstração fictícia no computador, no
  celular e no escuro, iguais à opção escolhida.

## Lições

- Editar a `docs/spec.md` muda o hash da aprovação dos módulos e o `guarda-escopo`
  passa a bloquear código; nota de leva vai para a spec da leva e para `docs/security.md`.
- O Playwright converte a configuração para CommonJS: módulo importado por ela não
  pode ter `import.meta` nem `await` no topo.
- O Next põe na página um anunciador de rota com `role="alert"`: teste que procura um
  alerta filtra pelo texto.
