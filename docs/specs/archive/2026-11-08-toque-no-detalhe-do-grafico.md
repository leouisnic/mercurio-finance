# Toque no detalhe do gráfico

Estado: concluída
Data: 2026-11-08. Arquivo: `docs/specs/archive/2026-11-08-toque-no-detalhe-do-grafico.md`.

## Problema medido

A CI do commit `cf7afa8` falhou ao tocar na barra do gráfico e esperar seu detalhe.
O teste original passou em oito repetições locais. Tocar novamente na mesma barra,
depois de confirmar o detalhe aberto, reproduziu o fechamento indevido no build local.
O botão externo ao Popover não registra seu gatilho, e o Radix o considera uma interação
externa. O evento de fechamento pode ocorrer depois da abertura pelo clique.
A sequência exata do primeiro toque que falhou na CI ainda não foi rastreada.

## Resultado esperado

Tocar na barra abre seu detalhe e repetir o toque o mantém aberto. Mouse, foco,
Escape e interação fora da barra continuam funcionando no Início e em Movimentos.

## Escopo

Corrigir o gatilho de `ColunaComDetalhe` e ampliar a regressão de toque existente.

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

## Como provar

- A regressão ampliada falha antes da correção e passa depois nos dois gráficos.
- Reverter o gatilho deve voltar a derrubar a regressão.
- Conferir abertura por mouse e teclado, Escape e toque fora, com dados fictícios.
- Rodar a suíte completa, obter revisão independente e acompanhar a CI do ajuste.

## Decisão visual

Nenhuma. A aparência aprovada, o alvo de toque e a âncora na barra são preservados.

## Validações obrigatórias

```json
{"versao": 2, "natureza": "produto", "mudanca": ["logica", "tela"], "aprovacoes": [], "locais": [{"id": "suite", "prova": "suite", "comando": ["uv", "run", "python", "scripts/validar.py", "--e2e"], "limite_s": 900}], "declaradas": {"regressao": "Segundo toque na barra com o detalhe aberto falhou antes da correcao. Primeiro toque e repeticao passaram oito vezes depois nos dois graficos.", "mutacao": "Retirar apenas preventDefault fez o teste falhar no primeiro toque. Fonte restaurada byte a byte em finally.", "borda": "Regressao ampliada passou com Escape, toque em outra barra, foco, Enter, mouse e saida do ponteiro.", "diff": "Ajuste restrito ao gatilho e sua regressao, preservando o trabalho publicado. Revisao independente conferiu o comportamento do Radix.", "tela": "Oito capturas ficticias inspecionadas no build em 390 e 1366 px, nos dois temas. Ancora acima da barra e balao dentro da largura da janela, com assercoes de geometria. Capturas e script temporarios apagados."}, "aceitacoes": []}
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
  tinha cerca de 600 MiB de memória livre após a execução. A repetição limita a afinidade
  do processo de validação a quatro CPUs, e o Playwright usa dois workers. O ambiente
  também usa `VITEST_MAX_WORKERS=2`.
- A suíte completa passou com esse limite, pelo contrato de fechamento da spec.
  A revisão independente conferiu gatilho, regressão e remoção da rolagem redundante,
  sem achados bloqueadores.

## Lições

- Abrir um Popover por estado não registra o botão como gatilho. O primeiro toque e
  o toque com o detalhe já aberto precisam de cobertura no navegador.

## Registro do fechamento

Conferido em: 2026-11-08T00:31:11.109741-03:00
Conteúdo validado: sha256:cc0f456e2259fab1fe3d5e66c2664543557486e293e44a1fcfe4307256b6d866
Contrato: sha256:519fab9c71ee8510e3076e22960e91fe7d6aeb41a9a24a974d095ba7465e5cd4

- A suíte terminou com código 0 pelo comando `["uv", "run", "python", "scripts/validar.py", "--e2e"]`.
