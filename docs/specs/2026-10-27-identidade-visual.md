# Identidade visual do Mercúrio

Estado: concluída
Data: 2026-10-27. Arquivo: `docs/specs/2026-10-27-identidade-visual.md`.

Executa as respostas V01 a V06 da `docs/spec.md`, aprovadas na concepção.

## Problema medido

- Dois nomes para o mesmo produto: "Vértice" na barra lateral, no título da aba
  (`apps/web/src/app/layout.tsx`), no `manifest.webmanifest`, no README público e em
  `docs/architecture.md`; "Mercúrio" no repositório e no resto da documentação.
- O símbolo é um desenho montado em SVG no código (`apps/web/src/app/logo.tsx`), que o dono
  acha feio, e o favicon é o `favicon.ico` padrão do framework.
- Não existe `assets/brand/`, nem variante de uma cor, nem ícone para o manifest.
- No celular, a barra lateral fixa de 232 px deixa 110 px de conteúdo em 390 px;
  `e2e/celular.spec.ts` roda com `test.fail`.
- Paleta e tema escuro nunca foram decididos olhando: a paleta atual é provisória (V04).

## Resultado esperado

- Só "Mercúrio" aparece para quem usa: tela, aba, manifest, README e documentação.
- Um símbolo gerado no Gemini, escolhido no mockup, em duas camadas: ilustração para tamanho
  grande e ícone simplificado legível em 16 px e em uma cor só.
- `assets/brand/` com os mestres; favicon, ícones do manifest (incluindo `maskable` e
  `monochrome`) e a variante de uma cor saem de um script do projeto, e um teste reprova
  arquivo de marca que não veio dele.
- Paleta nova com o contraste de cada par usado medido por comando; tema escuro decidido no
  mockup.
- Navegação de celular sem a barra lateral fixa; `e2e/celular.spec.ts` passa sem `test.fail`.
- Capturas públicas e README refeitos com a marca nova.

## Escopo

**Entra:** nome, símbolo, favicon e manifest, `assets/brand/` e o script das variantes, paleta
em `globals.css`, tema escuro se aprovado, navegação de celular, README e capturas.

**Fica de fora, de propósito:** o redesenho de Movimentos, Planejamento e Investimentos, que
vêm depois nascendo nesta identidade (`docs/ideias.md`); a Sora continua (V05).

## Práticas consultadas

- identidade-visual: duas camadas para ilustração; ícone conferido em 16 px e em uma cor;
  variantes por script com teste; contraste medido por comando; variante para fundo escuro;
  zona segura do `maskable` (círculo de raio 2/5) e silhueta no `monochrome`; editar imagem
  gerada pedindo a mudança de uma parte só; trocar a marca inclui trocar as capturas.
- acessibilidade-e-contraste: 4,5:1 para texto, 3:1 para ícone que é rótulo; a isenção do
  logotipo não cobre texto de interface na cor da marca.
- playwright: capturas de comparação no build, em 1440 e 390 px.
- nextjs-e-react: ícones pelas convenções de arquivo do App Router, conferidas na
  documentação antes do código.

## Fontes consultadas

- Next.js 16.2.9, ícones de app: github.com/vercel/next.js/blob/v16.2.9/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.mdx
  (`favicon.ico` só na raiz de `app/`, `icon` e `apple-icon` geram o `<link>` sozinhos).
- Termos de Serviço do Google, vigentes desde 30/07/2026: policies.google.com/terms (o
  Google não reivindica o conteúdo gerado; é proibido apresentar conteúdo gerado por IA
  como feito por pessoa, por isso a origem fica escrita em `assets/brand/README.md`).
- W3C Web Application Manifest (`purpose` `maskable` e `monochrome`): w3.org/TR/appmanifest/
- WCAG 2.2, 1.4.3 e 1.4.11: w3.org/WAI/WCAG22/Understanding/contrast-minimum e
  w3.org/WAI/WCAG22/Understanding/non-text-contrast

## Como provar

- Teste que lista os arquivos de marca do app e do README e reprova o que não está no
  manifesto gerado pelo script (hash de cada variante).
- Comando de contraste sobre os pares de cor usados, com o resultado anotado aqui.
- `e2e/celular.spec.ts` sem `test.fail`, mais axe nas telas.
- `grep` sem "Vértice" fora das specs antigas.
- Captura do build em 1440 e 390 px comparada com a opção escolhida.

## Decisão visual

A preencher no mockup `local/mockups/2026-10-27-identidade-visual/`. Primeira rodada: o
símbolo, gerado no Gemini pelo navegador do dono, em três caminhos escolhidos por ele:
órbita do planeta (ciclo curto, como os ciclos de pagamento), asa de Mercúrio e o deus
Mercúrio (elmo ou sandália alados, caduceu). Cada opção vista na barra lateral, na aba do
navegador, em 16 px e em uma cor.

- Símbolo em duas camadas: ilustração do perfil com elmo alado (Deus 1, refinada no Gemini
  mantendo perfil, elmo e asa) para tamanho grande, e o Ícone 6 da segunda rodada (a asa do
  elmo, penas abertas) para 16 px, aba, barra lateral e app. Recusados: órbita (em 16 px
  vira um ponto), Asa 2 e 4 e os ícones 1 a 4 (leem como letra W, E ou F), caduceu (lembra
  símbolo de saúde), rosto da Deus 4 (detalhe demais para 16 px).
- Terceira rodada, paleta e navegação: variante A (índigo sereno: fundo claro levemente
  frio, índigo do símbolo só na marca, no ciclo e no item ativo; no celular, barra embaixo
  com as quatro telas), com o dourado da C só no que é guardado (cofrinho e caixinha).
  Tema escuro com os mesmos papéis de cor e o símbolo em prata. Recusadas: lateral inteira
  em índigo (B), que disputa atenção com os números, e o dourado no item ativo (C).
- Depois de ver o escuro com o dado real: o tema segue o sistema, com um seletor de três
  opções (sistema, claro, escuro) no rodapé da barra lateral. No celular ele foi para uma
  faixa no topo com o ícone e o nome, que o mockup não tinha. Demarcação entre os blocos
  no escuro mantida como está, por escolha do dono.

## Validações obrigatórias

```json
{"versao": 2, "natureza": "produto", "mudanca": ["tela"], "aprovacoes": [], "locais": [{"id": "suite", "prova": "suite", "comando": ["uv", "run", "python", "scripts/validar.py", "--e2e"]}, {"id": "contraste", "prova": "tela", "comando": ["uv", "run", "python", "scripts/contraste.py"]}], "declaradas": {"regressao": "teste da marca reprova arquivo alterado e arquivo solto (conferido com um byte a mais e uma cópia feita à mão); e2e de celular passa sem test.fail e pegou o gráfico de Movimentos estourando a largura", "mutacao": "arquivo de marca alterado e arquivo solto em public/marca: os dois testes da marca falharam; voltando, passaram", "borda": "tema escuro com o símbolo em prata; tema escolhido sobrevive ao recarregar (e2e); voltar a seguir o sistema esquece a escolha (Vitest); ícone de 16 px; ícone mascarável dentro da zona segura; Movimentos e Recorrências em 390 px", "diff": "diff lido; nenhum nome real nem valor do banco real; origem da imagem gerada registrada como fato técnico", "tela": "capturas do build em 1440 px claro e escuro e 390 px claro, comparadas com a variante A da terceira rodada; capturas públicas refeitas com a base fictícia", "numero": "não se aplica: a leva não muda cálculo", "ida-e-volta": "não se aplica: sem migração"}, "aceitacoes": []}
```

## Riscos

- Os mestres vêm de JPEG gerado: o ícone foi pedido de novo em quadro inteiro (625 px) para
  o ícone do app não sair ampliado; nada foi redesenhado à mão.
- A escolha de tema fica no armazenamento do navegador: em janela anônima ou com o
  armazenamento bloqueado, vale só enquanto a página está aberta.

## Autorizações necessárias

Operar o Gemini no Chrome do dono (dada nesta conversa). Instalação de dependência para o
script de marca. Commit e push só com pedido.

## Registro da execução

- Símbolo gerado no Gemini, operado pelo navegador do dono, em três rodadas de mockup:
  doze opções em três caminhos, depois ilustração refinada e oito ícones da asa, e o ícone
  escolhido pedido de novo em quadro inteiro.
- `assets/brand/` com os dois mestres e `gerados.json`; `npm run marca` (sharp 0.35.4,
  declarado como dependência de desenvolvimento) gera favicon, `icon`, `apple-icon`, ícones
  do manifest (inclusive mascarável e monocromático) e as versões sem fundo para os dois
  temas, com as cores lidas de `globals.css`. `marca.test.ts` reprova arquivo que não veio
  do script.
- Paleta nova em `globals.css`, tema escuro pelo atributo `data-tema` (posto por um script no
  `<head>` antes da primeira pintura, com a escolha guardada ou a do sistema), dourado no cofrinho
  e na caixinha, e `sobre-cor` no lugar do branco fixo sobre preenchimento colorido.
- `scripts/contraste.py` mede 30 pares nos dois temas; todos no mínimo da WCAG. O dourado
  de preenchimento da caixinha estava em 2,17:1 no claro e foi escurecido para 3,44:1.
- Navegação: barra lateral a partir de 768 px, barra embaixo no celular; o gráfico de
  Movimentos mostra um rótulo a cada três dias no celular para caber.
- Só "Mercúrio" na tela, no título, no manifest, no README (com a ilustração em `<picture>`
  para claro e escuro) e na documentação; `logo.tsx` saiu e `e2e/vertice.spec.ts` virou
  `e2e/telas.spec.ts`.

- Dicas dos ícones de informação reescritas em uma frase curta cada, a pedido do dono:
  algumas eram longas e não explicavam nada; a da Variação listava quatro valores.

## Lições

- Imagem gerada em grade 2x2 dá um quarto da resolução por opção: escolhida a opção, pedir
  ela sozinha em quadro inteiro antes de virar mestre.
- Pedir "ícone simples" de uma asa trouxe quatro letras F: descrever a forma (penas abertas,
  pontas arredondadas, sem barras retas) resolveu na segunda tentativa.
- Teste de largura em 390 px achou o gráfico de Movimentos estourando em 532 px, que o
  `test.fail` antigo escondia.
