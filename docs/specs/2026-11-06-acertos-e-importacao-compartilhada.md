# Acertos e importação compartilhada

Estado: não iniciada
Data: 2026-11-06. Arquivo: `docs/specs/2026-11-06-acertos-e-importacao-compartilhada.md`.

Esta leva registra as decisões de produto. A implementação aguarda sua posição na fila,
amostras dos formatos e escolha visual. A próxima leva atual continua sendo dinheiro livre
quando estoura junto com plano do ciclo.

## Problema medido

O repositório importa contas do titular e categoriza movimentos, mas não representa a
participação em despesas pagas por outra pessoa nem o acerto de várias despesas por Pix.
A conciliação manual mostrou a necessidade de separar consumo, estorno, adiantamento e
pagamento, preservando pendências e parcelas futuras.

## Resultado esperado

- Importar extrato e fatura Nubank em PDF, CSV e OFX. Comparar arquivos do mesmo período
  para complementar informações sem contar a mesma compra ou fatura duas vezes.
- Revisar cada linha: tudo meu, metade, valor combinado, não é meu ou pendente. Linhas
  confirmadas entram no acerto; pendentes continuam visíveis e o acerto indica incompletude.
- Guardar regras aprovadas por compra, parcela ou identificação estável. Novos lançamentos
  e correspondências ambíguas são sugestões para revisão. Não aplicar uma divisão genérica
  a todas as compras de um marketplace nem repetir automaticamente uma exceção pontual.
- Mostrar as próximas parcelas e seu término, confirmando mudanças da origem antes de
  reaplicar o combinado.
- Um ou vários Pix podem liquidar várias categorias. O dono escolhe quanto paga por
  categoria. A sugestão de vínculo com o Pix importado precisa de confirmação.
- Manter saldo por pessoa e categoria, sem inventar quitação de itens individuais. Exemplo
  fictício: Casa de R$ 270, pagamento de R$ 200, saldo de R$ 70, com as compras preservadas.
- Estorno reduz a despesa original antes de aplicar a participação. Adiantamento ou
  pagamento excedente gera crédito da pessoa, que pode compensar outra categoria. O Pix
  liquida o saldo e não gera outra despesa; o saldo bancário continua vindo do banco.

## Escopo

**Entra:** importação revisável, origem e conciliação entre arquivos, participação por linha,
regras aprovadas, parcelas futuras, saldo por categoria, crédito e pagamento consolidado.

**Fica de fora, de propósito:** bot, áudio e leitura de fotos; login em lojas ou correio;
transferência bancária pela plataforma; reconstituição automática dos acertos deste chat;
mudanças da fórmula do dinheiro livre nesta leva documental.

## Práticas consultadas

- banco-de-dados-e-modelagem e postgres-e-docker: proveniência e identidade de importação
  distinguem duplicidade comprovada de compras iguais legítimas; migração só após modelo.
- seguranca-de-dados-e-agentes: dados de terceiro ficam no Postgres local; exemplos públicos
  fictícios. Não guardar PDFs, extratos ou recibos reais no repositório, mesmo ignorados.
- python-ruff-e-pytest: testes com valores calculados à mão e casos de estorno e reimportação.
- navegador-e-formularios e acessibilidade-e-contraste: escolhas explícitas, revisão de
  sugestão e pendência legível, sem depender só de cor.

## Fontes consultadas

Nenhuma API externa nova nesta etapa documental. Os esquemas e parsers serão definidos
pela leitura das amostras efetivas e da documentação oficial antes do código.

## Como provar

Na implementação: mesma compra em dois formatos não duplica; compras iguais distintas não
somem; reimportação é idempotente; crédito de devolução é dividido após reduzir a compra;
pagamento parcial mantém saldo por categoria; adiantamento não vira receita; Pix importado
e acerto confirmado não duplicam gasto; parcelas terminadas não reaparecem; pendentes não
somem do fechamento. Conferir os totais da prévia com uma base fictícia calculada à mão.

## Decisão visual

Nenhuma nesta etapa. Antes da interface, escolher mockup descartável para revisão das linhas
e divisão de um pagamento entre categorias.

## Validações obrigatórias

```json
{"versao": 2, "natureza": "documental", "mudanca": [], "aprovacoes": [], "locais": [], "declaradas": {}, "aceitacoes": []}
```

## Riscos

- Amostras CSV e OFX ainda ausentes. Não presumir colunas, identificadores ou conteúdo.
- Parcelas e estornos podem aparecer em documentos de períodos diferentes. Vínculo incerto
  permanece pendente; não abater automaticamente contra uma compra parecida.
- O período de lançamento pode diferir do consumo. Data sozinha não comprova participação.
- Pagamento planejado e pagamento confirmado são estados diferentes.

## Autorizações necessárias

Esta etapa autoriza apenas documentação. Antes de importar dados reais de terceiro,
confirmar arquivos selecionados e finalidade. Migração local, commit e publicação seguem
as autorizações próprias do projeto.
