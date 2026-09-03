# Regras de domínio

## Titularidades

Todo movimento financeiro pertence a exatamente uma titularidade: PF ou
PJ. Nunca fica ambíguo entre as duas.

MEI não é uma terceira titularidade com saldo próprio. O CNPJ do Leonardo
é registrado como MEI, e a conta Nubank PJ é a conta desse mesmo CNPJ: PJ
e MEI são a mesma empresa, a mesma conta, o mesmo saldo. MEI importa como
**regime tributário** da PJ, não como um lugar separado onde o dinheiro
fica. Isso muda a forma de calcular o DAS: o MEI paga um valor mensal
fixo por tabela (varia por tipo de atividade: comércio/indústria, serviço,
ou os dois), reajustado uma vez por ano, não um percentual do faturamento
como em outros regimes do Simples Nacional.

## Nubank PJ e Mercado Pago PF

- Nubank PJ é a conta do CNPJ (MEI) do Leonardo: recebe pagamentos de
  clientes e paga o DAS.
- Mercado Pago é conta PF.
- Transferência de Nubank PJ para Mercado Pago PF é retirada do titular
  na origem (PJ) e aporte do titular no destino (PF): não é despesa da PJ
  nem receita da PF. Ainda assim reduz o saldo da PJ e aumenta o saldo da
  PF, porque o dinheiro realmente muda de conta. Cada perna da
  transferência é um movimento próprio (`retirada_titular` na origem,
  `aporte_titular` no destino); nenhum dos dois entra em receita ou
  despesa.

## Reserva do DAS

O valor do DAS é reservado a partir do recebimento do mês, não só no dia
do vencimento. O painel mostra o valor já reservado e o valor previsto
para a competência atual.

A reserva não é lançada como uma linha de despesa no extrato: o dinheiro
continua na conta até o DAS ser pago de fato. Se a reserva fosse
registrada como despesa E o pagamento do DAS também, o valor sairia do
saldo duas vezes. `ReservaDas` é um valor calculado à parte, não derivado
de um movimento do tipo `despesa`.

O valor real da reserva (hoje fixo e fictício) ainda depende de implementar
a tabela de valores do DAS-MEI por atividade; ver
[decisions.md](./decisions.md).

## Conciliação e duplicidade

O identificador dado pelo banco não é chave única de conciliação. Já
foram encontrados nos dados reais do Leonardo:

- Lançamentos duplicados.
- O mesmo identificador bancário reaproveitado em lançamentos diferentes.
- Uma NFS-e presente nos XMLs mas ausente na planilha de controle.

Por isso a conciliação usa um fingerprint calculado a partir do conteúdo
do próprio movimento (titularidade, data, valor, descrição, tipo), e
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
