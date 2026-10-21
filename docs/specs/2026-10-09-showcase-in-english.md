# Vitrine em inglês, e a renomeação do código na fila

Estado: parte 1 concluída com o commit deste README, e a descrição e os tópicos do GitHub
aplicados logo depois do push; parte 2 medida e planejada, na fila depois das levas de número
Data: 2026-10-09. Executada em 2026-10-21.

Proposta escrita pela sessão do agent-workflow, pelo canal de specs, com aprovação do dono.
Nada mais foi alterado neste projeto. Quem mede, decide o desenho e executa é a sessão daqui.

## Problema medido

Medido em 09/10, de fora:

- este é o **único repositório público** do dono no GitHub;
- a descrição do repositório está vazia e não há tópicos;
- o README tem 101 linhas em português;
- os commits são em português;
- os 71 arquivos de código versionados (`.py`, `.ts`, `.tsx`) têm nomes em português, como
  `barra-lateral.tsx`, `buscar-movimentos.ts` e `acoes.ts`.

Quem chega de fora lê em inglês, e hoje encontra um repositório sem descrição e que não
consegue ler.

A regra do workflow, em `C:\dev\personal\agent-workflow\docs\glossary.md`, seção "Língua":
README, descrição e commit em inglês em todo repositório; código novo em inglês; processo,
texto de tela e termo de domínio brasileiro em português; projeto existente é renomeado
quando vira vitrine, em leva própria e só mecânica.

## Parte 1, urgente e curta: a vitrine

Não toca em código.

- README em inglês, no modelo `C:\dev\personal\agent-workflow\templates\readme-de-projeto.md`:
  o problema, início rápido, estrutura, como provar.
- Descrição e tópicos do repositório no GitHub, em inglês.
- Commits em inglês daqui para a frente. O histórico não é reescrito.

Antes de publicar texto novo, conferir de novo que nada do README cita dado real: este
repositório é público, e dado do Pluggy nunca entra nele.

## Parte 2, na fila: o código

Renomear arquivos e identificadores para inglês, em leva própria.

- **Só mecânica.** Suíte verde antes e depois, nenhum commit de lógica no meio, para a
  revisão não precisar separar renomeação de mudança de comportamento.
- **Preservar:** termo de domínio brasileiro (DAS, Pluggy, PF e PJ), texto de tela, que
  continua em português, e o que for contrato externo, como nome de coluna e de rota já usada.
- **Medir antes:** quantos arquivos e identificadores mudam, o que é contrato com o banco e
  com a API, e se cabe numa leva ou precisa ser por área (web, API, domínio, ingestão).
- **Ordem:** a sessão daqui decide se a parte 2 vem logo depois da parte 1 ou depois da
  concepção e dos módulos, que seguem pendentes neste projeto.

## Escopo

**Entra:** a parte 1 inteira; a medição e o plano da parte 2.

**Fica de fora, de propósito:** traduzir specs e `AGENTS.md`; traduzir texto de tela; mudar
comportamento; reescrever histórico.

## Práticas consultadas

Sugeridas por `praticas.py --sugerir .`; lidas as duas que tocam esta leva.

- identidade-visual: a marca mora num lugar só, e arquivo de marca feito à mão diverge. Medido
  aqui: o logo já existe em dois lugares e eles divergem (`apps/web/src/app/logo.tsx` com
  traço 2,6; `docs/design/logo.svg`, o aprovado, com 2,2). Por isso o logo não entrou à mão
  em `assets/brand/` nesta leva. Também medido: `apps/web/src/app/favicon.ico` ainda é o
  favicon padrão do Next.js, que a prática aponta como marca de outro na vitrine.
- seguranca-de-dados-e-agentes: captura pública e texto versionado só com dado fictício. O
  README usa as três capturas de `docs/telas`, geradas com o banco de teste, e nenhum trecho
  cita valor, conta ou instituição real.
- Não se aplicam, porque a leva não toca código: acessibilidade, banco, infraestrutura,
  navegador, Next.js, Playwright, Postgres e Python.

## Como provar

Parte 1: README em inglês renderizado no GitHub, descrição e tópicos preenchidos, e o
primeiro commit em inglês. Parte 2, a definir aqui: a mesma suíte passando antes e depois.

## Validações obrigatórias

```json
{"versao": 1, "natureza": "produto", "aprovacoes": [], "locais": [], "aceitacoes": []}
```

## Riscos

- Projeto meio renomeado é pior que qualquer um dos dois extremos: a parte 2 é leva inteira,
  nunca "ao tocar o arquivo".
- Renomear o que é contrato (coluna, rota, chave de configuração) quebra em produção sem
  quebrar no build.
- README novo em repositório público é o texto mais lido do projeto: erro nele aparece mais.

## Autorizações necessárias

Aprovação do dono para iniciar. Commit e push só com pedido. Mudança na descrição e nos
tópicos do GitHub é alteração pública e pede confirmação na hora.

## Registro da execução

### Parte 1

- Decisões do dono: README com as capturas; sem seção de status; descrição e tópicos
  aprovados no texto abaixo; logo adiado.
- README reescrito em inglês no modelo do workflow: o problema, o que o sistema faz, início
  rápido com o banco fictício, estrutura, como provar, o que ler e quando, e a nota de dados.
  Conferido contra o código antes de publicar: o CI roda migração do zero, Ruff, Pytest, lint,
  build, Vitest e Playwright, mas **não** a checagem de conteúdo, então o README não afirma
  isso.
- Renderizado pela API de markdown do GitHub: oito seções e sete imagens (três capturas,
  quatro selos). `validar_conteudo.py` aprovado; todo caminho de imagem e link existe.
- Logo fora desta leva: a trava de concepção recusa arquivo fora de `docs/` e dos documentos
  de raiz enquanto a triagem dos módulos não estiver aprovada em `docs/spec.md`. O dono
  escolheu esperar a concepção em vez de abrir exceção.
- Antes de versionar os arquivos de processo, dois trechos das specs foram neutralizados por
  serem pessoais e o repositório ser público: um caminho do Drive e a motivação ligada a
  busca de emprego. O sentido das specs não mudou.
- Descrição e tópicos aprovados para o GitHub:

  ```
  Personal finance dashboard on Brazilian Open Finance: syncs bank and credit card
  accounts through Pluggy, reconciles transactions and tracks pay cycles.
  Next.js, FastAPI, PostgreSQL.

  personal-finance, open-finance, open-banking, pluggy, nextjs, react, typescript,
  fastapi, python, postgresql, redis, sqlalchemy, playwright
  ```

### Parte 2, medida em 2026-10-21

63 arquivos de código versionados, sem contar migração:

```
apps/web                    31
services/finance-api        24
services/ingestion-worker    5
services/mercurio-domain     1
scripts                      2
```

Contrato que não se renomeia sem migração ou mudança coordenada:

- banco: 4 tabelas (`contas`, `movimentos`, `recorrencias`, `compromissos`) e 49 colunas
  mapeadas, com dado real no banco de desenvolvimento;
- valores gravados no banco, como `receita`, `despesa`, `aporte_titular` e os estados de
  pagamento de fatura, que também entram no fingerprint;
- 19 rotas da API, consumidas pelo `apps/web` e descritas em `integrations/hermes-plugin`.

Plano, decidido com o dono: a parte 2 vem **depois das duas levas de correção de número**,
porque renomear 63 arquivos no meio delas misturaria renomeação com mudança de comportamento
em todo diff. Por área, em leva própria e só mecânica: domínio e ingestão (6 arquivos)
primeiro, depois a API (24), depois o painel (31). Tabela, coluna, valor gravado e rota ficam
fora da renomeação mecânica; mudar qualquer um deles é decisão separada, com migração.

## Lições

- Antes de oferecer exceção a um hook, ler como ele é liberado. A variável que desliga a
  trava de escopo só vale no ambiente em que o agente foi aberto, então a "exceção pontual"
  oferecida para o logo nem funcionaria de dentro da sessão. O dono escolheu não usar, e por
  isso não houve dano.
- Spec escrita por outra sessão para um repositório público precisa de leitura de privacidade
  antes do primeiro commit que a expõe. Duas linhas eram sobre o dono, não sobre o projeto.
- O desenho já divergia entre duas cópias do mesmo logo antes de qualquer terceira cópia.
  Consolidar a marca num lugar só, gerada por script, cabe na leva de identidade visual, junto
  com o favicon padrão do Next.js.
