# Toque no detalhe do gráfico

Estado: concluída
Data: 2026-11-08. Arquivo: `docs/specs/archive/2026-11-08-toque-no-detalhe-do-grafico.md`.

## Problema medido

A CI do commit `cf7afa8` falhou ao tocar na barra do gráfico e esperar seu detalhe.
O teste original passou em oito repetições locais. Tocar novamente na mesma barra,
depois de confirmar o detalhe aberto, reproduziu o fechamento indevido no build local.
O botão externo ao Popover não registra seu gatilho, e o Radix o considera uma interação
externa. O evento de fechamento pode ocorrer depois da abertura pelo clique.
O primeiro toque exigiu a coleta posterior de eventos na CI.

A CI de `7476f55` repetiu a falha do primeiro toque. Com os scripts locais retidos,
o teste de navegador confirmou que o botão renderizado no servidor continua habilitado.
A hipótese de perda de interação antes da hidratação passa a ter reprodução controlada
da disponibilidade indevida do botão.

A coleta de `378d1c1` confirmou, nos dois testes, o clique de toque abrindo o detalhe,
seguido de `mouseout` do `SPAN` para `HEADER` e fechamento. O mesmo nó permaneceu
conectado, sem perda de foco nem `pointerout` de mouse nesse intervalo. A saída de mouse
aciona o handler de hover. O hover passa a usar Pointer Events, ignorando o tipo touch.

## Resultado esperado

Tocar na barra abre seu detalhe e repetir o toque o mantém aberto. Mouse, foco,
Escape e interação fora da barra continuam funcionando no Início e em Movimentos.

## Escopo

Corrigir o gatilho de `ColunaComDetalhe`, aguardar sua hidratação para habilitá-lo
e ampliar a regressão de toque existente. Permitir limitar os workers no ambiente local
para executar a validação completa com pouca memória, preservando o padrão sem a variável.
Colher os eventos do botão fictício para identificar o fechamento da CI. Encerrada a
coleta, remover o logger temporário e manter a regressão da sequência observada.

### Ficou de fora

Atualização de dependências, mudanças de aparência e regras financeiras ficam para
suas próprias levas.

## Práticas consultadas

- playwright. Reproduzir no build e conferir o comportamento visível com eventos de toque.
- nextjs-e-react. Preservar o estado controlado do componente e os eventos de abertura.
- acessibilidade-e-contraste. Usar o gatilho da biblioteca com sua relação acessível ao diálogo.
- navegador-e-formularios. Medir o balão na janela real do teste.

## Fontes consultadas

Radix UI 1.7.0 e Playwright do lockfile conferidos no ambiente instalado. Context7
confirma que o gatilho registrado impede a dispensa como interação externa e compõe
um toggle de clique. A documentação oficial apresenta Trigger e Anchor separados.
[Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover),
[Código do Popover](https://github.com/radix-ui/primitives/blob/main/packages/react/popover/src/popover.tsx).

A documentação de navegação foi consultada para avaliar a hipótese de hidratação.
A reprodução com o detalhe já aberto demonstra que existe também uma falha posterior
à hidratação. [Playwright](https://playwright.dev/docs/navigations).

O gesto de toque já faz a rolagem e resolve o alvo durante suas verificações.
[Playwright Locator.tap](https://playwright.dev/docs/api/class-locator#locator-tap).

React 19.2.8 usa `getServerSnapshot` no servidor e na hidratação inicial. O snapshot
do cliente permite habilitar o controle após essa etapa. Aplicação do contrato conferida
via Context7 e fonte oficial. [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore).

O encerramento das rotas espera os handlers retidos terminarem.
[Playwright Page.unrouteAll](https://playwright.dev/docs/api/class-page#page-unroute-all).

O número de workers pode ser configurado. A versão instalada 1.62.1 resolve o padrão
pela quantidade de CPUs, independente da afinidade do processo.
[Playwright TestConfig.workers](https://playwright.dev/docs/api/class-testconfig#test-config-workers).

Pointer Events expõe o tipo do dispositivo e permite separar hover de mouse e caneta
do fim de um toque. Context7 e fontes oficiais conferidos.
[React PointerEvent](https://react.dev/reference/react-dom/components/common#pointerevent-handler),
[W3C Pointer Events](https://www.w3.org/TR/pointerevents3/#compatibility-mapping-with-mouse-events).

## Como provar

- A regressão ampliada falha antes da correção e passa depois nos dois gráficos.
- Reter scripts locais demonstra o botão desabilitado no HTML inicial. O primeiro
  gesto aguarda a liberação dos scripts e abre o detalhe nos dois gráficos.
- Reverter o gatilho deve voltar a derrubar a regressão.
- Conferir abertura por mouse e teclado, Escape e toque fora, com dados fictícios.
- Rodar a suíte completa, obter revisão independente e acompanhar a CI do ajuste.

## Decisão visual

Nenhuma. A aparência aprovada, o alvo de toque e a âncora na barra são preservados.

## Validações obrigatórias

```json
{"versao": 2, "natureza": "produto", "mudanca": ["logica", "tela"], "aprovacoes": [], "locais": [{"id": "suite", "prova": "suite", "comando": ["uv", "run", "python", "scripts/validar.py", "--e2e"], "limite_s": 900}], "declaradas": {"regressao": "Segundo toque na barra com o detalhe aberto falhou antes da correcao. Primeiro toque e repeticao passaram oito vezes depois nos dois graficos. Gate de scripts confirmou controle habilitado indevidamente antes da hidratacao. Gate e interacao completa passaram quatro repeticoes cada apos disabled por snapshot. Sequencia mouseout SPAN para HEADER registrada na CI e reproduzida localmente com falha antes da correcao. Pointer Events passaram quatro repeticoes de cada teste de toque.", "mutacao": "Retirar apenas preventDefault fez o teste falhar no primeiro toque. Fonte restaurada byte a byte em finally. Retirar apenas disabled derrubou o gate em toBeDisabled. Fonte restaurada byte a byte em finally. Restaurar hover por mouse derrubou a assercao apos mouseout na linha 249. Retirar guarda touch derrubou a assercao apos pointerout na linha 251. Ambas restauradas byte a byte.", "borda": "Regressao ampliada passou com Escape, toque em outra barra, foco, Enter, mouse e saida do ponteiro. SSR desabilitado, primeiro gesto iniciado antes de liberar os scripts, rotas liberadas e encerradas em finally nas duas paginas. Configuracao efetiva por --list confirmou 6 workers sem variavel, 1 e 2 com a variavel. Zero, negativo, texto e fracao foram rejeitados antes dos testes. Saida de toque preserva o detalhe. Mouse e caneta abrem e fecham por hover, teclado e toque repetido continuam cobertos.", "diff": "Ajuste restrito ao gatilho e sua regressao, preservando o trabalho publicado. Revisao independente conferiu o comportamento do Radix. Logger temporario removido apos identificar a causa, com revisao independente da correcao e das mutacoes.", "tela": "Oito capturas ficticias inspecionadas no build em 390 e 1366 px, nos dois temas. Ancora acima da barra e balao dentro da largura da janela, com assercoes de geometria. Capturas e script temporarios apagados. Inspecao repetida apos a protecao de hidratacao, com oito novas capturas e quatro testes de geometria aprovados. Build final com Pointer Events conferido novamente nas oito capturas e quatro casos de geometria, sem alteracao de apresentacao."}, "aceitacoes": []}
```

## Riscos

O foco abre o detalhe antes do clique. O toggle padrão do Trigger precisa ser tratado
para que esse clique preserve a abertura. O evento de interação externa continua
necessário para fechar o detalhe quando o alvo é outro elemento.

## Autorizações necessárias

Commit e push fazem parte da entrega autorizada nesta sessão. Os testes usam a base
fictícia local e da CI.

## Registro da execução

- A CI inicial aprovou backend, lint, build e Vitest. O Playwright falhou com
  27 testes aprovados, um reprovado, seis dependentes sem execução e uma captura opcional omitida.
- A repetição local original passou oito vezes. A regressão de segundo toque falhou
  antes da correção, com o diálogo ausente.
- A correção com Trigger e prevenção do toggle passou oito repetições. Retirar apenas
  a prevenção derrubou o teste no primeiro toque. A fonte foi restaurada byte a byte.
- A regressão ampliada de teclado, toque fora e mouse passou. Quatro conferências
  visuais adicionais passaram, cobrindo os dois gráficos nas duas larguras e temas.
  As oito capturas foram inspecionadas e removidas junto com o script temporário.
- A primeira suíte completa encontrou a rolagem explícita do teste sobre um elemento
  substituído durante a hidratação. O teste passa a usar a rolagem do próprio `tap`,
  preservando as verificações de interação e posição, sem espera fixa.
- A segunda execução encontrou encerramento do Chromium ao criar uma página. A máquina
  tinha cerca de 600 MiB de memória livre após a execução. A repetição limitou a afinidade
  do processo de validação a quatro CPUs. A suposição de que isso reduziria o Playwright
  a dois workers foi corrigida depois pela leitura da versão instalada, que usa a
  quantidade de CPUs. O ambiente também usa `VITEST_MAX_WORKERS=2`.
- A suíte completa passou com esse limite, pelo contrato de fechamento da spec.
  A revisão independente conferiu gatilho, regressão e remoção da rolagem redundante,
  sem achados bloqueadores.
- A spec foi reaberta após a CI de `7476f55` repetir a falha do primeiro toque.
  O teste com scripts retidos falhou por encontrar o botão habilitado no HTML inicial.
- O botão agora aguarda a hidratação com o snapshot de servidor falso e o do cliente
  verdadeiro. O gate de scripts e a regressão completa de interação passaram quatro
  repetições cada. Retirar somente `disabled` derrubou o gate na asserção esperada,
  com restauração byte a byte da fonte.
- A inspeção visual foi repetida no build com a proteção de hidratação. As quatro
  verificações de geometria passaram e as oito capturas foram conferidas e apagadas.
- A revalidação completa encontrou uma página encerrada pelo Chromium e falhas em
  navegações já cobertas. Os dois testes de toque passaram nessa execução. A memória
  livre medida após a execução era cerca de 529 MiB. Reduzir a afinidade para duas CPUs
  também manteve o paralelismo padrão. A configuração passa a aceitar
  `PLAYWRIGHT_MAX_WORKERS`, e a execução local usa o valor 1, mantendo a suíte inteira.

- A leitura da configuração efetiva por `--list` confirmou seis workers sem a
  variável, um com o valor 1 e dois com o valor 2. Zero, negativo, texto e fração
  foram rejeitados. A nova execução usa `PLAYWRIGHT_MAX_WORKERS=1` e
  `VITEST_MAX_WORKERS=2`, sem limitar a afinidade de CPU.
- A suíte completa passou com esses limites confirmados na configuração efetiva.
  A revisão independente conferiu a proteção de hidratação, o gate, a opção local
  de workers e a correção do registro de execução, sem bloqueios.
- A CI de `5e7e371` confirmou o estado inicial desabilitado, mas perdeu o detalhe
  depois do primeiro toque nos dois testes. O gate corrige uma disponibilidade
  indevida reproduzida e ainda não explica o fechamento na CI. A spec foi reaberta
  para colher os eventos e o estado dessa execução, usando somente a base fictícia.
- O diagnóstico distingue alvo interno e externo, identifica cada nó do botão e
  registra montagem, remoção, atributos e origem nativa dos eventos. Uma falha
  intencional depois da abertura confirmou JSON válido com montagem, toque, clique
  confiável e transição de `aria-expanded`. O teste foi restaurado byte a byte.
  Página encerrada preserva o erro original e informa a indisponibilidade do diagnóstico.
- Os dois traces da CI de `378d1c1` mostraram o mesmo nó aberto no clique e fechado
  após `mouseout` para `HEADER`. A revisão independente conferiu os dois JSON.
  A reprodução local da saída de mouse falhou com o detalhe ausente antes da correção.
  O logger temporário foi removido depois de cumprir sua finalidade.
  [Execução de diagnóstico](https://github.com/leouisnic/mercurio-finance/actions/runs/42490075036).
- Os dois testes de toque passaram quatro repetições cada com Pointer Events.
  Restaurar o hover por eventos de mouse derrubou a asserção após `SPAN` para `HEADER`.
  Retirar a guarda de touch derrubou a asserção após `pointerout`. As duas fontes foram
  restauradas byte a byte. A inspeção visual final passou nos quatro casos, com oito
  capturas conferidas e removidas.
- A suíte completa do fechamento passou com a correção de Pointer Events, usando
  `PLAYWRIGHT_MAX_WORKERS=1` e `VITEST_MAX_WORKERS=2` no ambiente local.

## Lições

- Abrir um Popover por estado não registra o botão como gatilho. O primeiro toque e
  o toque com o detalhe já aberto precisam de cobertura no navegador.
- Controle renderizado no servidor precisa refletir sua disponibilidade de interação.
  Gate de scripts mede a janela anterior à hidratação sem adicionar espera fixa.
- Liberar rotas retidas e aguardar seus handlers evita que o encerramento do teste
  responda à mesma requisição duas vezes.
- Afinidade do processo não define o paralelismo do Playwright 1.62.1. Conferir a
  quantidade resolvida de workers, em vez de inferi-la da quantidade de CPUs disponíveis.
- Hover usa Pointer Events para distinguir o dispositivo. Um mouseout posterior ao
  toque pode fechar uma interface recém-aberta quando tratado como saída de hover.

## Registro do fechamento

Conferido em: 2026-11-08T15:32:10.188384-03:00
Conteúdo validado: sha256:d6d8ea17d2947c9bd55d8a594ec48efe5ce854b00fd2a4f15ee90cdb3ae386aa
Contrato: sha256:5b2ab4f61a92c63e4b9206e387efc32802c870c03682189c006d1c3d6c064f71

- A suíte terminou com código 0 pelo comando `["uv", "run", "python", "scripts/validar.py", "--e2e"]`.
