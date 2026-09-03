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

## Contas reais e o que está conectado no Pluggy

O Leonardo tem três contas na prática, só duas conectadas no Pluggy hoje:

- **Nubank PF** (conectada): conta pessoal, uso do dia a dia.
- **Mercado Pago PF** (conectada): outra conta pessoal.
- **Nubank PJ** (não conectada): a conta do CNPJ (MEI). Por instrução do
  contador, ela é só intermediária: recebe o pagamento da nota fiscal do
  cliente e o dinheiro sai de lá logo em seguida (paga o DAS, transfere o
  resto para a PF). O saldo dela fica sempre perto de zero por causa
  disso, então não há um "saldo da PJ" relevante para acompanhar hoje.
  `Titularidade.PJ` continua existindo no código porque a conta é real;
  ela só não tem movimento importado até (e se) for conectada no Pluggy.

Transferência entre titularidades (por exemplo, da PJ para a PF, quando o
Leonardo retira o que sobrou depois do DAS) é retirada do titular na
origem e aporte do titular no destino: não é despesa de quem manda nem
receita de quem recebe, mas ainda reduz o saldo de origem e aumenta o de
destino, porque o dinheiro muda de conta de verdade. Cada perna é um
movimento próprio (`retirada_titular` na origem, `aporte_titular` no
destino). O mesmo vale para transferência entre as duas contas PF
conectadas (Nubank PF ↔ Mercado Pago PF): mesmo sendo a mesma
titularidade nos dois lados, a Pluggy já identifica esse caso como
`"Same person transfer"` e o Mercúrio trata do mesmo jeito, não como
receita nem despesa.

## Obrigação do DAS

Não existe reserva progressiva: o Leonardo recebe o pagamento da nota
fiscal na conta PJ, paga o DAS como prioridade e transfere o resto para a
PF no mesmo momento, então não há um valor "sendo reservado" ao longo do
mês para acompanhar. O DAS-MEI é um valor fixo mensal (R$ 86,05, hoje;
configurável por `DAS_VALOR`), reajustado uma vez por ano pela tabela do
MEI, não percentual de faturamento.

O pagamento do DAS sai da conta PJ, que não está conectada no Pluggy (ver
acima), então nenhum movimento importado mostra esse pagamento. Por isso
`ObrigacaoDas.paga` não é inferida do extrato: é marcada à mão
(`POST /das/pagar`), uma vez por competência.

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
