import { buscarJson, paraNumero, paraNumeroOuNull } from "./api";

export type Conta = {
  id: string;
  nome: string;
  apelido: string | null;
  tipo: "BANK" | "CREDIT";
  saldo: number;
  limite: number | null;
  disponivel: number | null;
  bandeira: string | null;
  final: string | null;
  /** Datas da fatura em aberto. Nulas para conta corrente. */
  fechamento: string | null;
  vencimento: string | null;
};

export type ResumoFinanceiro = {
  atualizadoEm: string | null;
  contas: Conta[];
};

type RespostaApiConta = {
  id: string;
  nome: string;
  apelido: string | null;
  tipo: "BANK" | "CREDIT";
  saldo: string;
  limite: string | null;
  disponivel: string | null;
  bandeira: string | null;
  final: string | null;
  fechamento: string | null;
  vencimento: string | null;
};

type RespostaApi = {
  atualizado_em: string | null;
  contas: RespostaApiConta[];
};

/** Contas conectadas e seus saldos, como a Pluggy relata. */
export async function buscarResumo(): Promise<ResumoFinanceiro | null> {
  const corpo = await buscarJson<RespostaApi>("/resumo");
  if (corpo === null) {
    return null;
  }

  return {
    atualizadoEm: corpo.atualizado_em,
    contas: corpo.contas.map((conta) => ({
      id: conta.id,
      nome: conta.nome,
      apelido: conta.apelido,
      tipo: conta.tipo,
      saldo: paraNumero(conta.saldo),
      limite: paraNumeroOuNull(conta.limite),
      disponivel: paraNumeroOuNull(conta.disponivel),
      bandeira: conta.bandeira,
      final: conta.final,
      fechamento: conta.fechamento,
      vencimento: conta.vencimento,
    })),
  };
}
