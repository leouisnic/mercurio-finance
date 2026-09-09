/**
 * Identidade visual de cada conta no painel.
 *
 * O nome vem cru da Pluggy e nem sempre diz o banco: o cartão do Nubank
 * chega como "gold", e a conta corrente como "Nu Pagamentos S.A. -
 * Instituição de Pagamento (Conta Pré-paga)". O `connector.name` do item
 * também pode não identificar corretamente a instituição.
 *
 * Por isso aqui só há encurtamento de nome que já contém o banco, e cor
 * para quem é reconhecível. Conta que não casa fica com o cinza neutro,
 * em vez de receber um banco chutado.
 */

const BANCOS: { padrao: RegExp; nome: string; classe: string }[] = [
  { padrao: /nu ?bank|nu pagamentos/i, nome: "Nubank", classe: "bg-nubank" },
  { padrao: /mercado ?pago/i, nome: "Mercado Pago", classe: "bg-mercadopago" },
];

export function nomeDaConta(nome: string): string {
  return BANCOS.find(({ padrao }) => padrao.test(nome))?.nome ?? nome;
}

export function classeDoBanco(nome: string): string {
  return BANCOS.find(({ padrao }) => padrao.test(nome))?.classe ?? "bg-tinta-3";
}

export function inicialDoBanco(nome: string): string {
  return (nomeDaConta(nome).trim()[0] ?? "?").toUpperCase();
}

export function SeloDoBanco({ nome, tamanho = 38 }: { nome: string; tamanho?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: tamanho, height: tamanho, borderRadius: tamanho * 0.29 }}
      className={`${classeDoBanco(nome)} flex shrink-0 items-center justify-center font-bold text-white`}
    >
      <span style={{ fontSize: tamanho * 0.4 }}>{inicialDoBanco(nome)}</span>
    </span>
  );
}
