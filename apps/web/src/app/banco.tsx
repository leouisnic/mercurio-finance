/**
 * Identidade visual de cada conta no painel.
 *
 * O nome vem cru da Pluggy e nem sempre diz o banco: o cartão do Nubank
 * chega como "gold", e a conta corrente como "Nu Pagamentos S.A. -
 * Instituição de Pagamento (Conta Pré-paga)". O `connector.name` do item
 * também pode não identificar corretamente a instituição.
 *
 * Ordem de preferência: o apelido que o Leonardo definiu, depois o
 * encurtamento de nome que já contém o banco, e por último o nome cru.
 * Conta que não casa fica com o cinza neutro, em vez de receber um banco
 * chutado.
 */

const BANCOS: { padrao: RegExp; nome: string; classe: string }[] = [
  { padrao: /nu ?bank|nu pagamentos/i, nome: "Nubank", classe: "bg-nubank" },
  { padrao: /mercado ?pago/i, nome: "Mercado Pago", classe: "bg-mercadopago" },
];

/** Uma conta como o painel precisa dela para se identificar. */
export type ContaIdentificavel = { nome: string; apelido?: string | null };

function banco({ nome, apelido }: ContaIdentificavel) {
  // O apelido também é procurado: quem chama a conta de "Cartão Nubank"
  // espera o roxo do Nubank, não o cinza.
  return BANCOS.find(({ padrao }) => padrao.test(apelido ?? "") || padrao.test(nome));
}

export function nomeDaConta(conta: ContaIdentificavel): string {
  return conta.apelido ?? banco(conta)?.nome ?? conta.nome;
}

export function classeDoBanco(conta: ContaIdentificavel): string {
  return banco(conta)?.classe ?? "bg-tinta-3";
}

export function inicialDoBanco(conta: ContaIdentificavel): string {
  return (nomeDaConta(conta).trim()[0] ?? "?").toUpperCase();
}

export function SeloDoBanco({
  conta,
  tamanho = 38,
}: {
  conta: ContaIdentificavel;
  tamanho?: number;
}) {
  return (
    <span
      aria-hidden
      style={{ width: tamanho, height: tamanho, borderRadius: tamanho * 0.29 }}
      className={`${classeDoBanco(conta)} flex shrink-0 items-center justify-center font-bold text-white`}
    >
      <span style={{ fontSize: tamanho * 0.4 }}>{inicialDoBanco(conta)}</span>
    </span>
  );
}
