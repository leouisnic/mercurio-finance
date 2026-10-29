# Tags e gráficos

Estado: concluída
Data: 2026-10-28. Arquivo: `docs/specs/2026-10-28-tags-e-graficos.md`.

Vem da leva de categorias próprias (`docs/specs/2026-10-28-categorias-proprias.md`) e do uso
com o dado real. Base para o modo viagem, que é uma tag com período (`docs/ideias.md`).

## Problema medido

- A página Tags (`/movimentos/tags`) mostra só uma pílula por tag com o gasto. Não dá para
  criar tag antes de ter movimento, renomear, apagar, nem saber quanto uma viagem pesou no
  orçamento. O dono achou "bem básica".
- O detalhe dos dois gráficos de gasto por dia é o `title` do navegador (`grafico-do-ciclo.tsx`
  e `grafico-gasto-diario.tsx`): caixa preta do sistema, fora da identidade, que não abre no
  toque do celular.
- No gráfico do Início, o número em cima da barra é inteiro sem moeda ("147"), só nos dias que
  passaram da cota; dia sem gasto e dia dentro da cota têm a mesma cor cinza.

## Resultado esperado

Decidido com o dono antes desta spec:

- Barras do gasto por dia no Início: dia sem gasto em dourado (a cor do cofrinho), gastou
  dentro da cota em índigo, passou da cota em vermelho. A cor nunca é o único sinal: valor
  escrito e legenda vão junto.
- Valor curto com moeda em cima de cada barra com gasto ("R$ 147"), e ao passar o mouse ou
  tocar, um detalhe no padrão do Mercúrio, o mesmo para todos os gráficos.
- Página Tags com: orçamento por tag (teto e, opcionalmente, datas), evolução do gasto no
  tempo, criar, renomear, apagar (os movimentos ficam, só perdem a tag) e arquivar, maiores
  gastos e divisão por categoria, e o impacto da tag no orçamento.
- Impacto calculado sem IA: quanto a tag tirou de cada ciclo em que caiu, quanto esses ciclos
  passaram do gasto típico, e em quantos ciclos isso se recupera no ritmo de sobra.

## Decisões do dono

Decididas em três rodadas do mockup `local/mockups/2026-10-28-tags-e-graficos/`:

1. Detalhe do gráfico: dia, valor, quanto passou da cota (sem citar o valor da cota) e os
   maiores movimentos do dia. Saem as barras pontilhadas dos dias que ainda vêm; o eixo
   continua até o fim do ciclo.
2. Gráfico de Movimentos: as mesmas cores no ciclo atual, com a cota de hoje; em ciclo
   passado, índigo e dourado, sem linha de cota. Fica porque mostra ciclos passados e filtra
   por conta, o que o do Início não faz.
3. Página Tags: cartões com faixa na cor da tag no topo, ícone e nome nela, valor grande,
   teto como frase ("Faltam R$ 1.580 de R$ 9.000", sem separador) e barra fina; sem teto,
   nada. Movimentos e período com ícone, datas por extenso. "Nova tag" no topo da página.
   Formulário com prévia, ícone e cor, teto por atalhos e período por atalhos ou datas.
4. Tag aberta: cabeçalho com editar, arquivar e apagar; faixa com gasto, ritmo e maior
   gasto; a leitura em texto corrido, cada frase tirada de um número; o impacto com os dois
   números e o gráfico dos ciclos; gasto acumulado e divisão por categoria; maiores gastos.
   Típico é a média dos 3 ciclos anteriores; rombo é quanto o ciclo da tag passou do típico;
   recupera em é o rombo dividido pela sobra média desses ciclos.

## Escopo

**Entra:** tabela de tags ganha teto, datas e arquivada; API para criar, editar, apagar e
arquivar tag e para a evolução e o impacto; página Tags refeita; componente de detalhe de
gráfico usado pelos dois gráficos; cores e valores das barras do Início.

**Fica de fora, de propósito:** modo viagem (ideia própria, usa as datas da tag); análise dos
gastos; mudança no cálculo da cota e do dinheiro livre (leva "Dinheiro livre quando estoura");
filtros da página Tags (ano e mês, situação, busca pelo nome e teto), pedidos no aceite e
deixados pelo dono para a leva seguinte, para o mês e o ano saírem do nome da tag.

## Práticas consultadas

- acessibilidade-e-contraste: cor nunca é o único sinal; contraste das três cores das barras
  medido nos dois temas por `scripts/contraste.py`; alvo de toque de pelo menos 24 px no
  detalhe do gráfico.
- banco-de-dados-e-modelagem: teto em `numeric`, nunca `float`; migração com ida e volta no
  banco de teste antes do local.
- nextjs-e-react: mutações por Server Action que confere a resposta da API, como as de
  categoria; o detalhe do gráfico é componente de cliente só onde precisa de interação.

## Fontes consultadas

- Radix Tooltip, já usado em `info.tsx`: o detalhe do gráfico segue o mesmo padrão, aberto
  ao passar o mouse e no foco, e controlado para abrir e fechar também no toque. Cada coluna
  traz o próprio provedor, para o gráfico funcionar fora do provedor do layout.

## Como provar

- Pytest: teto e datas da tag, apagar mantém os movimentos, arquivar tira da lista principal,
  impacto calculado à mão num caso fictício de três ciclos.
- Vitest: cor e rótulo de cada tipo de dia, detalhe abre no toque e no foco, formulário de tag.
- Playwright: leitura da página Tags e do detalhe; mutável criando tag com teto.
- `scripts/contraste.py` com as cores novas; capturas fictícias nos dois temas e larguras.

## Validações obrigatórias

```json
{"versao": 2, "natureza": "produto", "mudanca": ["logica", "tela", "dado", "migracao"], "aprovacoes": [], "locais": [{"id": "suite", "prova": "suite", "comando": ["uv", "run", "python", "scripts/validar.py", "--e2e"]}, {"id": "contraste", "prova": "tela", "comando": ["uv", "run", "python", "scripts/contraste.py"]}], "declaradas": {"regressao": "test_tags.py com o impacto feito à mão, sem ciclo anterior, sem rombo, criar, editar, arquivar, apagar e o resumo; Vitest das cores e do detalhe dos dois gráficos, da leitura, do teto e do formulário; e2e mutável marcando tag e criando tag com teto", "mutacao": "largura do celular na tag aberta: falhou com 473 px antes da correção da tabela escondida, passou depois; recuperação com round no lugar de ceil: dois testes de test_tags.py falharam; barra acima da cota sem vermelho: passou na primeira vez, o teste ganhou a checagem da cor da barra e passou a falhar com a mutação; desfeitas, passaram", "borda": "tag sem gasto não tem achados; previsão só com o período em andamento; menos de três dias sem desenho nos cartões; sem ciclo anterior com dado não há impacto; sem sobra não há previsão; tag sem teto não mostra frase nem barra; ciclo passado no gráfico de Movimentos sem cota nem vermelho; filtro por conta tira a cota; dias depois de hoje sem barra", "diff": "diff lido; nenhum nome real nem valor do banco real em arquivo versionado; exemplos com viagem Exemplo e Pousada Exemplo", "tela": "capturas fictícias do gráfico do Início com o detalhe aberto, da página Tags, do formulário e da tag aberta, nos dois temas e em 1280 e 390 px, comparadas com a terceira rodada do mockup", "numero": "impacto conferido com a conta à mão no teste (típico 3.000, rombo 2.400, sobra 1.000, 3 ciclos); tag não muda o gasto por dia (teste da leva anterior)", "ida-e-volta": "migração e5a8c1d40f72 com upgrade, downgrade e upgrade no mercurio_test antes do banco local"}, "aceitacoes": []}
```

## Riscos

- "Gasto típico" depende de haver ciclos sem a tag para comparar; com histórico curto, o
  impacto mostra só o gasto da tag, sem a comparação.

## Autorizações necessárias

Migração nova no banco de desenvolvimento. Commit e push só com pedido.

## Registro da execução

- Migração `e5a8c1d40f72`: `tags` ganha `icone`, `cor`, `teto` (`numeric`), `inicio`, `fim` e
  `arquivada`. Ida e volta no `mercurio_test` antes do banco local.
- `finance_api/tags.py` calcula a análise sem banco: total, dias, por dia, maiores gastos,
  dia mais caro, acumulado, categoria principal e o impacto. Teste com a conta feita à mão.
- API: `POST`, `PATCH` e `DELETE /tags`, `GET /tags/{id}` com a análise e o típico da
  categoria principal, e `maiores` em `GET /movimentos/gastos-diarios` e em
  `GET /dinheiro-livre` (no Início com o mesmo filtro da barra, sem conta fixa).
- Tela: `detalhe-do-grafico.tsx` é o detalhe único dos dois gráficos; `tag.tsx` tem o
  cartão, a tag aberta e a leitura, montada no painel a partir dos números da API;
  `formulario-de-tag.tsx` cria, edita, arquiva e apaga (confirmação na própria tela, nunca na
  caixa do navegador); a tag aberta mora em `/movimentos/tags/{id}`, e o endereço antigo
  `?tag=N` redireciona.
- Defeito pego pela validação: `moedaCurta` estava no arquivo de cliente do detalhe e o
  servidor a chamava; o build parou. Foi para `formato.ts`.
- No celular, a tag aberta passava da tela (tabela para leitor de tela sem contenção) e o
  título sumia espremido pelos botões. A tabela foi para dentro de um `div` escondido, o
  mesmo no gráfico do Início, e os botões descem para a linha de baixo quando não cabem.
- Validação: 192 Pytest, 76 Vitest e 23 Playwright (`validar.py --e2e`), contraste sem par abaixo do mínimo. Capturas fictícias do gráfico do Início
  com o detalhe aberto, da página Tags, do formulário e da tag aberta, nos dois temas e em
  1280 e 390 px.

### Ajustes depois de usar com o dado real

- Detalhe do gráfico preso à barra (`Popover.Anchor`) e não à coluna, que o abria no topo do
  gráfico; dia sem gasto em verde, com quanto da cota foi para o cofrinho.
- Impacto: a leitura atribuía à tag todo o excesso do ciclo. Agora separa a parte da tag,
  limitada ao que ela gastou no ciclo (`rombo_da_tag`), e a recuperação usa só essa parte.
- Ciclo com o nome de quem paga e mês por extenso ("Ciclo X de outubro"); "out" não se lia
  como outubro.
- Categoria para vários num balão que se posiciona sozinho (colisão do Radix Popover), sem
  estourar a tela.
- Hover em tudo que é clicável; círculo de cor com o contorno do tamanho dele; teto em
  passos de R$ 100; notas explicativas no (i).
- Arredondamento único: centavos em todo valor, meio centavo para cima, um módulo só
  (`centavos.py`) e um teste que reprova arredondamento fora dele.
- Categoria Hospedagem (migração `f1b6d3e8a204`), com a categoria `1202` da Pluggy traduzida
  para ela.
- Marcar vários com tag no mesmo balão da categoria, com busca e "Criar".
- A leitura em texto virou cartões (`leitura.tsx`): os três de cima (gasto, ritmo, maior
  gasto) e achados que só aparecem quando se aplicam (categoria acima do normal, gasto
  concentrado, fim de semana ou dias úteis, ritmo, previsão para o teto, dias sem gasto),
  sem repetir número que já está na página. Cada cartão tem título em cima e, embaixo, o
  número com a linha de apoio e o desenho ao lado; com menos de três dias, sem desenho.

## Lições

- Mudar a API e não reiniciar a que está rodando deixa o painel pedindo um campo que não
  existe: apareceu "R$ NaN" para o dono. Depois de mexer na API, reiniciar antes de mostrar.
- Conferir na tela, com o dado real, antes de mostrar ao dono: título longo, mês abreviado e
  janela sem texto passaram pelos testes.
- Teste de cor que olha só o texto deixa passar a cor da barra: a mutação mostrou. Conferir
  o elemento que carrega a cor.
- Função usada pelo servidor não mora em arquivo `"use client"`, mesmo sendo só formatação:
  o build quebra ao chamar. Formatação comum vai para `formato.ts`.
- Uma tabela com `sr-only` ignora a largura de 1 px e alarga a página: a tag aberta media
  473 px num celular de 390 e nenhum teste olhava essa página, porque ela só existe depois
  de marcar. Tabela escondida mora dentro de um `div` com `sr-only`, e a largura da tag
  aberta passou a ser conferida no e2e mutável.

## Registro do fechamento

Conferido em: 2026-10-29T13:01:03.691978-03:00
Conteúdo validado: sha256:f25a9347d6320b09bc0a45ea459fccf9fc7319226306c88004a240baa9225bf2
Contrato: sha256:005e918e8ef2a2d51728c71c88ca8e3762d17b4703c6dd4c79dc38d51b7749ae

- suite: código 0; comando `["uv", "run", "python", "scripts/validar.py", "--e2e"]`.
- contraste: código 0; comando `["uv", "run", "python", "scripts/contraste.py"]`.
