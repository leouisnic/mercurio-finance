# Regras de domínio

## Contas

Cada conta conectada aparece separadamente. Conta `BANK` mostra saldo. Conta
`CREDIT` mostra fatura atual, limite, disponibilidade e datas quando informadas
pela instituição.

O saldo mostrado vem da Pluggy. Movimentos locais servem para análise,
conciliação e histórico, não para reconstruir o saldo bancário.

## Tipos de movimento

- `receita`: dinheiro que entra no conjunto de contas.
- `despesa`: dinheiro que sai do conjunto de contas.
- `aporte_titular`: entrada causada por transferência entre contas do mesmo
  titular.
- `retirada_titular`: saída causada por transferência entre contas do mesmo
  titular.

Transferências próprias aparecem no histórico, mas não entram em receitas ou
despesas consolidadas.

## Conciliação e duplicidade

O fingerprint usa conta, data, valor, descrição e tipo normalizados. O
identificador externo nunca é suficiente sozinho.

- Mesmo fingerprint e mesmo identificador: duplicidade confirmada, descartada
  na inserção.
- Mesmo fingerprint e identificador diferente: possível duplicidade, mantida
  no total e sinalizada como valor em revisão.

Possíveis duplicidades não participam da detecção automática de recorrência.

## Pagamento de fatura

A compra no cartão é a despesa. A saída bancária usada para pagar a fatura é
uma transferência e fica fora do gasto para impedir dupla contagem.

O casamento automático exige:

- saída `despesa` em conta `BANK`;
- categoria de transferência da Pluggy;
- baixa de fatura em conta `CREDIT`;
- valor exato;
- diferença máxima de três dias;
- uma única contraparte elegível para cada perna.

Se qualquer perna tiver mais de uma contraparte possível, nada é marcado. A
revisão humana pode confirmar uma despesa bancária não detectada ou descartar
uma marcação existente. Receita e movimento de cartão não podem ser marcados.

## Recorrências

Uma candidata precisa de pelo menos três despesas com a mesma conta e
descrição, em sequência. Cada intervalo deve ficar entre 28 e 35 dias. A
variação de valor permitida é de 15%.

Toda candidata nasce `pendente`. Aprovação e rejeição são humanas. Uma
recorrência rejeitada não volta automaticamente para a fila.

## Compromissos

Compromisso representa obrigação futura cadastrada manualmente. Possui valor
por parcela, data inicial, data final e status. Não é conciliado automaticamente
com movimentos bancários.

## Ciclos

P1 é o dia bancário útil anterior ou igual ao dia 5. P2 é o dia bancário útil
posterior ou igual ao dia 15.

- Ciclo 1: P1 até a véspera de P2.
- Ciclo 2: P2 até a véspera de P1 do mês seguinte.

Os ciclos são contínuos e não se sobrepõem. O calendário considera fins de
semana, feriados nacionais aplicáveis e dias nacionais sem expediente bancário
definidos para a regra.

## Operações sensíveis

Pagamentos, transferências, emissão ou cancelamento de notas e qualquer ação
que mova dinheiro exigem confirmação humana explícita. Integrações atuais são
somente leitura.
