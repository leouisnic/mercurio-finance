# Token na API

Estado: em andamento
Data: 2026-11-10. Arquivo: `docs/specs/2026-11-10-token-na-api.md`.

Implementa o B03 da concepção (`docs/spec.md`): a API exige token mesmo escutando só em
127.0.0.1, antes da senha do painel. O I02 já decidiu onde o token mora e como troca, e o
I05 pede um teste de acesso sem token por rota.

## Problema medido

- Qualquer processo desta máquina lê e altera o dado financeiro pela API na porta 8000,
  sem credencial: `/resumo`, `/movimentos` e as rotas de escrita respondem a quem
  chamar. Conferido lendo `finance_api/main.py`: nenhuma rota tem dependência de
  autenticação nem middleware.
- O painel chama a API de dois lugares, `apps/web/src/app/api.ts` (leitura) e
  `acoes.ts` (ações do servidor), ambos no servidor do Next.

## Resultado esperado

- Toda rota da API, menos `/health`, responde 401 com `WWW-Authenticate: Bearer` sem o
  cabeçalho `Authorization: Bearer <token>` certo. `/health` só diz que a API está de pé.
- O painel manda o token em toda chamada, lido de `FINANCE_API_TOKEN` só no servidor; o
  token não aparece em nenhum arquivo entregue ao navegador.
- Sem `FINANCE_API_TOKEN` configurado, a API não sobe: falha alto em vez de ficar aberta.
- O atalho do Mercúrio gera o token no `.env` na primeira vez, sem passo manual.

## Decisões

- Do dono, na concepção: B03, I02 e I05, citados acima.
- Variável `FINANCE_API_TOKEN`, ao lado de `FINANCE_API_URL`. A API lê do `.env` da raiz;
  o painel recebe do atalho, que lê o mesmo `.env`.
- Cabeçalho `Authorization: Bearer`, comparado em tempo constante
  (`secrets.compare_digest`).
- Middleware, não dependência por rota: rota nova nasce protegida. `/health` fica de fora
  porque o atalho e o e2e esperam por ela antes de qualquer token, e ela não devolve dado.
  A documentação interativa (`/docs`, `/openapi.json`) também passa a exigir token.
- Token gerado com 32 bytes aleatórios do sistema, em base64 para URL.
- Token recusado aparece no painel como hoje, "Indisponível", e o servidor do painel
  registra no log que a API recusou o token, para a causa não ficar escondida.
- O worker não chama a API; continua falando direto com o banco e a fila.
- Regras puras usadas no navegador saem dos arquivos de busca: `levaCategoria`,
  `marcaDoDia` e as categorias de recorrência ganharam arquivo próprio, porque o
  `server-only` recusou a compilação enquanto um componente do navegador importava
  um arquivo que chama a API.
- O atalho lê o token depois de compilar o painel: com ele no ambiente durante a
  compilação, o valor ia parar no cache do Turbopack.

## Escopo

- Entra: middleware na API, token no painel (leitura e ações), geração no atalho,
  `.env.example`, e2e e CI com token fictício, passo de troca em `docs/security.md`.
- Fica de fora: senha do painel (leva própria, I02), limite de taxa (B02, quando a API
  sair de 127.0.0.1), credencial própria do bot e do Hermes (I01, quando existirem).

## Práticas consultadas

- seguranca-de-dados-e-agentes: segredo só no `.env`, fora do Git; nenhum token real em
  teste, log ou commit.
- nextjs-e-react: `import "server-only"` no módulo que lê o token, para a compilação
  falhar se um componente do navegador importar.
- windows-e-powershell: geração do token no atalho com o gerador do .NET, sem ferramenta
  nova.
- python-ruff-e-pytest: teste por rota, gerado da lista de rotas da aplicação, para rota
  nova não escapar.
- playwright: o e2e sobe a API e o painel com o mesmo token fictício.
- acessibilidade-e-contraste, identidade-visual, banco-de-dados-e-modelagem,
  postgres-e-docker, infraestrutura-e-nuvem, navegador-e-formularios: não se aplicam, sem
  tela, banco ou nuvem novos.

## Fontes consultadas

- [FastAPI, Middleware](https://fastapi.tiangolo.com/tutorial/middleware/), via Context7:
  `@app.middleware("http")` roda antes da rota e pode devolver a resposta direto.
- [FastAPI, Security reference](https://fastapi.tiangolo.com/reference/security/) e
  [RFC 9110, 401](https://datatracker.ietf.org/doc/html/rfc9110#name-401-unauthorized):
  a resposta 401 leva `WWW-Authenticate`.
- [Next.js, Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components),
  via Context7: só variável `NEXT_PUBLIC_` vai para o navegador, e `server-only` faz a
  compilação falhar se o módulo for importado no cliente.

## Como provar

- Teste gerado das rotas da aplicação: cada método e caminho sem token e com token errado
  devolve 401 com `WWW-Authenticate: Bearer`; `/health` devolve 200 sem token.
- Com token certo, a suíte inteira continua passando (o cliente de teste manda o token).
- Sem `FINANCE_API_TOKEN`, a aplicação recusa subir com mensagem clara.
- Mutação: desligar o middleware faz o teste por rota falhar.
- O e2e passa com API e painel usando o token fictício.
- Compilação de produção: o valor do token não aparece em nenhum arquivo de
  `.next-e2e/static`.
- Atalho: sem a linha no `.env`, ele cria; com a linha, mantém.

## Validações obrigatórias

```json
{
  "versao": 2,
  "natureza": "produto",
  "mudanca": ["logica", "permissao"],
  "aprovacoes": [],
  "locais": [
    {"id": "suite", "prova": "suite", "comando": [".venv/Scripts/python.exe", "scripts/validar.py", "--e2e"], "limite_s": 1800}
  ],
  "declaradas": {},
  "aceitacoes": [
    {"id": "uso", "criterio": "O painel real abre pelo atalho com o token gerado e a API recusa chamada sem ele"}
  ]
}
```

## Riscos

- Token fora de sincronia entre API e painel deixa tudo "Indisponível"; o log do painel
  diz a causa e o atalho lê o mesmo `.env` para os dois.
- Quem roda a API à mão sem o `.env` vê a recusa em subir; o README da demonstração
  passa a mostrar a variável.

## Autorizações necessárias

Commit e push pedem autorização. Escrever o token no `.env` local é feito pelo atalho.

## Ponto de retomada

- Implementado e validado; falta a revisão do dono e o commit. O `.env` local já tem
  o token, gerado pelo script do atalho.

## Registro da execução

- 10/11. Decisões já registradas na concepção; documentação do FastAPI e do Next.js
  conferida.
- 10/11. Middleware na API e `chamarApi` no painel. `test_token.py` gera um caso por
  rota da aplicação: sem token, com token errado e sem o prefixo, 401 com
  `WWW-Authenticate: Bearer`; `/health` responde sem token; sem token configurado a
  API recusa subir. Mutação: sem o middleware, 66 dos 69 falham.
- 10/11. O `server-only` recusou a primeira compilação: três componentes do navegador
  importavam regra pura de arquivos de busca. As regras foram separadas. Na compilação
  de produção o token fictício não aparece em `static` nem em `server`; apareceu só no
  cache do Turbopack, e o atalho passou a ler o token depois de compilar.
- 10/11. Geração do token no atalho provada com arquivos temporários: cria sem linha,
  devolve o mesmo na segunda vez, preenche a linha vazia no lugar, grava sem BOM.
- 10/11. Ambiente real, com o token gerado no `.env` pelo mesmo script: `/health` 200
  sem token, `/resumo` 401 sem token e com token errado e 200 com o do `.env`,
  `/docs` 401. A API foi derrubada em seguida.
- 10/11. `scripts/validar.py --e2e` aprovado: Ruff e ESLint limpos, build, 306 Pytest,
  100 Vitest e 35 Playwright. Os testes do e2e que conferem a API direto passaram a
  mandar o token (`e2e/token.ts`).

## Lições

- `server-only` no módulo que lê o segredo acha na compilação o import do navegador que
  passaria despercebido; regra pura não mora em arquivo que chama a API.
- Variável de ambiente presente durante a compilação vai para o cache do Turbopack:
  segredo do servidor entra no ambiente só na hora de subir o processo.
- Compilar em pasta nova (`NEXT_DIST_DIR`) faz o Next acrescentar a pasta no
  `tsconfig.json`; desfazer depois da checagem.
