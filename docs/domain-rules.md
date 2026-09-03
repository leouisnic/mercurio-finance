# Regras de domínio

## Contas, não titularidade

O painel mostra uma conta por vez (não um agregado por PF/PJ): cada conta
que o Leonardo conecta no Pluggy vira um card, com o nome, o tipo
(`BANK` ou `CREDIT`) e o saldo que a própria Pluggy relata. Nada disso é
fixo no código; conectar um banco novo é só acrescentar o `itemId` dele
em `PLUGGY_ITEM_IDS`.

Hoje duas contas estão conectadas (Nubank e Mercado Pago), cada uma com
conta corrente e cartão de crédito, quatro contas ao todo. O Leonardo
também tem uma conta PJ (CNPJ do MEI), mas ela não está conectada: por
instrução do contador, serve só de intermediária para receber pagamento
de nota fiscal (o dinheiro sai de lá quase no mesmo momento que entra,
paga o DAS e transfere o resto), então o saldo dela fica sempre perto de
zero e não há um número relevante para mostrar ali.

Conta corrente mostra **saldo**. Cartão de crédito mostra a **fatura
atual** (o valor já usado, não o saldo disponível), com o limite como
contexto: são naturezas diferentes, um é dinheiro disponível, o outro é
dívida.

## Movimento entre contas do próprio Leonardo

Transferência entre duas contas dele (por exemplo, da PJ não conectada
para uma conta PF, ou entre Nubank e Mercado Pago) é retirada na origem e
aporte no destino: não é despesa de quem manda nem receita de quem
recebe, mas ainda reduz o saldo de origem e aumenta o de destino, porque
o dinheiro muda de conta de verdade. Cada perna é um movimento próprio
(`retirada_titular` na origem, `aporte_titular` no destino). A Pluggy já
identifica esse caso como `"Same person transfer"`; o Mercúrio usa essa
categoria para decidir o tipo, em vez de tentar adivinhar pela descrição.

## Conciliação e duplicidade

O identificador dado pelo banco não é chave única de conciliação. Já
foram encontrados nos dados reais do Leonardo:

- Lançamentos duplicados.
- O mesmo identificador bancário reaproveitado em lançamentos diferentes.
- Uma NFS-e presente nos XMLs mas ausente na planilha de controle.

Por isso a conciliação usa um fingerprint calculado a partir do conteúdo
do próprio movimento (conta, data, valor, descrição, tipo), e
registra a proveniência (extrato bancário, XML de NFS-e, importação
manual). A regra de fingerprint fica em um único lugar,
`services/mercurio-domain`, usada tanto pela `finance-api` quanto pelo
`ingestion-worker`: as duas implementações já divergiram uma vez (valor e
data formatados de jeitos diferentes), o que fazia o mesmo movimento vindo
de fontes diferentes não ser reconhecido como igual.

Duas camadas de duplicidade, não uma só:

- **Confirmada**: mesmo fingerprint E mesmo identificador externo. É o
  caso de uma mesma linha de origem importada mais de uma vez; entra
  automaticamente como duplicidade e não é somada duas vezes no resumo.
- **Possível**: mesmo fingerprint, identificador externo diferente.
  Ambíguo por natureza (pode ser duplicidade real com identificador
  reaproveitado, ou dois eventos legítimos e coincidentemente iguais, como
  duas compras de mesmo valor no mesmo dia). Fica marcado para revisão
  humana, mas continua somado no resumo até alguém decidir.

Ver `services/mercurio-domain/src/mercurio_domain/__init__.py`,
`services/finance-api/src/finance_api/domain.py` e
`services/ingestion-worker/src/ingestion_worker/extrato.py`.

## Fontes de dado

- Extrato bancário é a fonte principal.
- Mobills dá categoria e contexto, não é fonte primária.
- NFS-e começa por importação manual de XML. Integração oficial com
  certificado A1 fica para depois.

## Confirmação humana

Pagamento, transferência e emissão ou cancelamento de nota fiscal sempre
exigem confirmação humana explícita. Nenhum agente executa essas ações
sozinho. Ver `integrations/hermes-plugin/contrato.md`.
