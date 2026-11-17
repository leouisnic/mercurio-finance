# Categorias de receita e reembolso

Estado: em andamento
Data: 2026-11-13. Arquivo: `docs/specs/2026-11-13-categorias-de-receita-e-reembolso.md`.

O dono testou o painel pelo celular e apontou três coisas: não há categoria de receita,
o Pix que amigos mandam para pagar uma compra feita por eles conta como renda e não
abate o gasto, e a escolha de categoria no celular é pequena demais para usar.

## Problema medido

- As 20 categorias são uma lista só para despesa e receita; para receita, só "Salário e
  extras" serve. Medido no banco local em 13/11, por contagem: receitas guardadas em
  categorias de despesa por escolha do dono (Farmácia), pelo Mobills (Pix para pessoas,
  Outros, Investimento e reserva) e por regra de destinatário (Pix para pessoas, Saúde,
  Investimento e reserva). As de Investimento e reserva são rendimentos.
- Nenhuma soma de gasto olha receita: o Pix de volta não abate a categoria nem o dia.
- A escolha de categoria abre num balão de 380 px limitado à altura livre; no celular,
  com o teclado da busca aberto, sobra quase nada.

## Resultado esperado

Revisão em 16/11: confirmada a devolução no ciclo em que o Pix chegou. A sugestão
de quanto guardar fica indisponível quando a estimativa histórica é negativa,
com explicação distinta de histórico insuficiente. Qualquer sugestão válida
respeita o livre atual. Pix de saída que paga várias categorias segue na leva
de acertos; a categoria única não representa esse pagamento agrupado.

- Categorias de entrada: Salário e extras, Rendimentos, Vendas, Presentes recebidos e
  Outras entradas; o dono cria outras como já cria as de despesa.
- Receita que o dono põe numa categoria de despesa é reembolso: abate o gasto daquela
  categoria e o do dia em que chega, e não conta como renda.
- No celular, a escolha de categoria ocupa a tela, com a lista rolando e o Salvar
  sempre à vista. Para uma receita, mostra primeiro as entradas e depois "Devolveu um
  gasto", com as categorias de despesa e uma explicação só.

## Decisões

- Confirmado em 16/11: abater a devolução na data de entrada do Pix, inclusive
  quando a compra ocorreu em outro ciclo. Preservar o ciclo anterior.
- Média negativa suspende a sugestão de quanto guardar. A API informa o motivo,
  e a tela mostra "Sem estimativa" com a explicação. A sugestão válida fica
  limitada ao livre não negativo antes do arredondamento em dezenas.
- Como a migração inicial já foi aplicada, corrigir as classificações antigas
  em uma revisão posterior. Desfazer a revisão não reconstrói escolhas apagadas;
  a recuperação dessas escolhas exige o backup anterior.
- Do dono, em 13/11: reembolso abate o gasto (como Mobills e YNAB); entra pelo dia em
  que o Pix chega; escolha em tela cheia no celular (opção A do mockup); a lista de
  entradas proposta; sem a explicação repetida em cada categoria; receitas antigas em
  "Pix para pessoas" e "Saúde" voltam para "Para classificar", porque são misturadas.
- Rendimentos guardados em "Investimento e reserva" vão para "Rendimentos", e a
  tradução da Pluggy do rendimento (`0306`) passa a dar "Rendimentos". Receitas em
  "Outros" vão para "Outras entradas".
- Só o dono cria reembolso: regra por destinatário e tradução da Pluggy nunca põem uma
  receita em categoria de despesa. Sem isso, a regra do destinatário de um Pix enviado
  marcaria o Pix recebido da mesma pessoa.
- Reembolso vale só para o movimento escolhido: o "Vale para" some quando a escolha é
  de despesa para uma receita, porque a regra do destinatário mudaria também os Pix
  enviados a ele.
- O reembolso entra em toda soma de gasto (por dia, por categoria, por tag, totais do
  ciclo, dinheiro livre e média do dia a dia) com o valor negativo, e sai das somas de
  receita. O fluxo de cada conta (Entrou e Saiu) continua contando o dinheiro como
  entrou, porque fecha com o saldo. A lista de maiores gastos do dia e a detecção de
  recorrência continuam só com despesas.
- Dia com mais reembolso que gasto fica com gasto negativo nas somas; no gráfico, a
  barra não desce abaixo de zero.
- A análise detalhada por categoria fica para a Movimentos redesenhada, que o dono pediu
  "direta, objetiva e visual".

## Escopo

- Entra: tipo da categoria, categorias de entrada, migração das receitas existentes,
  reembolso nas somas, bloqueio automático, escolha em tela cheia no celular e
  agrupada para receita, etiqueta "Devolveu" no movimento.
- Fica de fora: análise por categoria nova (Movimentos redesenhada), dividir uma compra
  entre pessoas no momento da compra (leva de acertos, `2026-11-06`).

## Práticas consultadas

- banco-de-dados-e-modelagem e postgres-e-docker: migração com dado, provada no banco de
  teste antes do local, backup antes.
- python-ruff-e-pytest: somas conferidas à mão com exemplo fictício; regressão provada.
- nextjs-e-react, navegador-e-formularios, acessibilidade-e-contraste: diálogo em tela
  cheia com foco preso e Esc, campo de busca com 16 px, rótulos.
- playwright: escolha de categoria pelo celular no e2e.
- seguranca-de-dados-e-agentes: contagens do banco real só nesta spec, sem valores.
- windows-e-powershell: processos em segundo plano, execução de testes e limpeza
  explícita dos artefatos temporários.
- identidade-visual e infraestrutura-e-nuvem: não se aplicam; padrão visual existente.

## Fontes consultadas

- [Docker Compose start](https://docs.docker.com/reference/cli/docker/compose/start/),
  conferido com Context7 e Compose 5.5.0 instalado. Os contêineres existentes
  ficaram disponíveis ao iniciar o Docker Desktop em segundo plano.
- [Alembic, Operations.execute](https://alembic.sqlalchemy.org/en/latest/ops.html#alembic.operations.Operations.execute),
  conferido com Context7 e as assinaturas de `execute` e `Operations.context` do
  Alembic 1.19.1 instalado. A documentação atual está em 1.20.1; a operação usada
  também está presente na versão instalada.
- [Playwright, locators](https://playwright.dev/docs/locators), conferido com
  Context7 para a versão 1.62.1. Escolha por papel e nome acessível e confirmação
  pela API após salvar na interface.

## Decisão visual

Escolhida pelo dono em 13/11 no mockup `local/mockups/2026-11-13-categorias-de-receita-e-reembolso/`
(publicado também como página privada para ver no celular): opção A, tela cheia no
celular, com busca de 16 px, grupos "Usadas antes" e "Todas" em duas colunas, rodapé
fixo com "Vale para" e Salvar; para receita, grupos "Entradas" e "Devolveu um gasto",
com uma linha de explicação só no segundo grupo. No computador, o balão de hoje.

## Como provar

- Histórico líquido negativo não produz sugestão de poupança. Histórico
  insuficiente e média negativa têm motivos distintos na resposta e na tela.
- Sugestão nunca supera o livre, incluindo gasto no dia maior que a estimativa,
  livre negativo, livre zero e arredondamento em dezenas.
- Migração corretiva em dados fictícios limpa receitas de Saúde e Pix para
  pessoas, inclusive de origem do dono, preserva Farmácia e despesas e é idempotente.
- Despesa com histórico de categorias de receita continua oferecendo apenas
  categorias de despesa, tanto no celular quanto no computador.
- Receita com histórico misto mantém entradas antes de "Devolveu um gasto",
  sem repetir categorias nem deslocar uma delas para fora de seu grupo.
- À mão, fictício: Farmácia com compra de 180 e dois Pix de 60 em dias diferentes; gasto
  da categoria 60; gasto do dia da compra 120 (o Pix do mesmo dia abate); dia do segundo
  Pix com 60 a menos; receita do ciclo sem os 120.
- Regra e Pluggy: receita de destinatário com regra de despesa fica para classificar;
  rendimento da Pluggy vai para Rendimentos.
- Migração no banco de teste com casos fictícios de cada origem; banco local com backup,
  contagem antes e depois.
- e2e no celular: a escolha abre em tela cheia e o Salvar fica visível com a lista
  rolada; para receita, aparecem os dois grupos.

## Validações obrigatórias

```json
{
  "versao": 2,
  "natureza": "produto",
  "mudanca": ["logica", "tela", "dado", "migracao"],
  "aprovacoes": [],
  "locais": [
    {"id": "suite", "prova": "suite", "comando": [".venv/Scripts/python.exe", "scripts/validar.py", "--e2e"], "limite_s": 1800}
  ],
  "declaradas": {
    "regressao": "Quatro casos do historico de categorias, tres regras da sugestao e o estado Sem estimativa falharam antes das respectivas correcoes e passaram depois.",
    "mutacao": "Retirar a suspensao por media negativa, trocar o limite pelo livre e omitir a reclassificacao fez cada regressao falhar. Fontes restauradas byte a byte.",
    "borda": "Receita sem categoria, tipos mistos no historico, devolucao em outro ciclo, media negativa, historico insuficiente, livre zero e negativo, arredondamento e repeticao da migracao.",
    "diff": "Mudancas anteriores preservadas. Spec de diagrama pertence a outra leva e fica fora desta entrega. Exemplos e capturas ficticios; arquivos locais e credenciais fora do Git.",
    "tela": "Oito capturas do build inspecionadas em 390 e 1366 px, claro e escuro, entrada e despesa. Salvar e dialogo dentro do viewport. Capturas e teste visual temporarios removidos.",
    "numero": "Compra ficticia 180 e duas devolucoes de 60 deixam gasto 60; compra em ciclo anterior permanece 180 e devolucao no seguinte abate 60. Livre 109,99 com gasto hoje 200 e estimativa 10 limita sugestao a 100,00.",
    "contrato": "API informa savings_suggestion_reason; conversao para o painel preserva motivo e valor nulo; teste no celular salva e confirma categoria e abatimento pela API.",
    "ida-e-volta": "d9e4c6a1b732 aplicada no banco de teste. Operacao corretiva, repeticao e recuo conferidos com dados ficticios. Recuar preserva a reclassificacao; restaurar escolhas antigas exige backup. Banco local ainda nao migrado."
  },
  "aceitacoes": [
    {"id": "uso", "criterio": "O dono marca o Pix de um amigo como reembolso pelo celular e vê a categoria abater"}
  ]
}
```

## Riscos

- Um Pix de saída pode pagar a participação em farmácia junto de outras despesas.
  A categoria única do movimento não representa essa composição. Os exemplos de
  revisão precisam incluir pagamento agrupado e sua distribuição entre categorias,
  conforme a spec de acertos de 06/11. A devolução simples não resolve esse caso.
- Muitas somas mudam juntas; um ponto único em SQL (`_conta_no_gasto` e
  `_valor_no_gasto`) evita que cada consulta implemente a regra do seu jeito.
- Dia com gasto negativo pode confundir cofrinho e gráfico; coberto por teste.

## Autorizações necessárias

Migração no banco local com backup; commit e push pedem autorização.

## Ponto de retomada

- Implementação local anterior preservada, ainda sem commit. Nesta retomada,
  corrigidas sugestões incompatíveis com o tipo do movimento e a ordem dos grupos.
- A migração existente preserva receitas antigas em Saúde e Pix para pessoas
  quando a origem é do dono, divergindo da decisão registrada. Há registro de sua
  aplicação local e backup anterior. A revisão corretiva `d9e4c6a1b732` foi aplicada
  somente no banco de teste. A prévia agregada local não encontrou linhas elegíveis;
  a aplicação local, com backup, ainda depende de autorização.
- Média líquida negativa pode sugerir guardar mais que o livre. Reproduzido com
  livre fictício de 100 e média diária de -10 em dez dias: sugestão de 200.
  Corrigido com suspensão por média negativa, motivo explícito e limite pelo livre.
- Validação funcional completa aprovada. Foram conferidas oito capturas do build
  em 390 e 1366 px nos temas claro e escuro. A decisão visual anterior foi preservada.
- Falta revisão da versão para commit e aceite de uso. Acertos com Pix agrupado
  continuam na leva de 06/11; a fatura do Mercado Pago é a próxima investigação.

## Registro da execução

- 13/11. Retorno do dono pelo celular, mockup publicado e escolhido, medição das
  receitas já categorizadas.
- 16/11. Revisão do diff e do fim da conversa anterior. A suíte do frontend passou
  com 120 testes; TypeScript, ESLint, Ruff e conteúdo aprovados. Dois problemas
  reproduzidos em memória: seleção de despesa com categoria de receita no histórico
  e migração que mantém classificações antigas de origem do dono.
- 16/11. Regras de devolução reabertas para explicação visual. Continuidade das
  correções de categoria autorizada; sem nova alteração nos cálculos financeiros.
- 16/11. Quatro regressões falharam antes da correção do histórico e passaram
  depois, no celular e no computador. Suíte completa do frontend com 124 testes,
  ESLint e build de produção aprovados. O build precisou executar fora do sandbox
  após EPERM na pasta ignorada `.next-validacao`. Integração com banco e inspeção
  visual do produto continuam pendentes. Exemplos fictícios de devolução preparados
  separadamente para a conversa, sem alterar o comportamento financeiro.
- 16/11. Confirmado o abatimento no ciclo de entrada do Pix. Retomada a proteção
  escolhida de suspender sugestão com média negativa e limitar a sugestão ao livre.
  Docker iniciado em segundo plano; ambos os bancos estão na revisão inicial
  de categorias de receita. A correção posterior será provada no banco de teste.
- 16/11. Validação completa por `scripts/validar.py --e2e`, com 322 Pytest,
  128 Vitest, Ruff, ESLint e builds aprovados. Playwright: 47 aprovados, dos quais
  quatro eram verificações visuais temporárias, e uma captura pública opcional
  omitida por configuração. O teste permanente de devolução no celular confirmou
  persistência na API, abatimento no dia e permanência após recarregar.
- 16/11. A primeira passagem do teste de devolução falhou ao tentar clicar no
  rádio oculto, interceptado pelo ícone. Corrigido o teste para o rótulo visível.
  A passagem final teve sucesso. Permanece aviso de navegação do Next, digest
  `2676330508`, e duas depreciações Python; não impediram a validação.
- 16/11. Três mutações detectadas: retirar suspensão por média negativa, retirar
  o limite pelo livre e omitir a reclassificação da migração. Os testes falharam
  nos casos esperados e as fontes foram restauradas byte a byte. Revisão de
  migração, repetição e recuo executados apenas com dados fictícios.

## Lições

- Uma falha em patch com vários arquivos pode deixar alterações já aplicadas.
  Conferir o diff e os arquivos reais antes de repetir a operação.
- Teste de toque escolhe o rótulo visível de um rádio oculto. Forçar o clique
  no input não comprovaria o caminho usado na interface.
