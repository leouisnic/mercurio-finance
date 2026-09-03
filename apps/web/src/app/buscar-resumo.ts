export type Conta = {
  id: string;
  nome: string;
  tipo: "BANK" | "CREDIT";
  saldo: number;
  limite: number | null;
  disponivel: number | null;
};

export type ResumoFinanceiro = {
  atualizadoEm: string;
  contas: Conta[];
};

type RespostaApiConta = {
  id: string;
  nome: string;
  tipo: "BANK" | "CREDIT";
  saldo: string;
  limite: string | null;
  disponivel: string | null;
};

type RespostaApi = {
  atualizado_em: string;
  contas: RespostaApiConta[];
};

const FINANCE_API_URL = process.env.FINANCE_API_URL ?? "http://localhost:8000";

function paraNumeroOuNull(valor: string | null): number | null {
  return valor === null ? null : Number(valor);
}

/**
 * Busca o resumo financeiro no finance-api. Os valores chegam como string no
 * JSON porque o Pydantic serializa Decimal assim; aqui já convertem para
 * number, formato que o resto do painel espera.
 *
 * Devolve null em qualquer falha (rede, API fora do ar, resposta inválida)
 * em vez de lançar: em desenvolvimento o finance-api pode não estar rodando,
 * e a página trata esse caso mostrando uma mensagem em vez de quebrar.
 */
export async function buscarResumo(): Promise<ResumoFinanceiro | null> {
  try {
    const resposta = await fetch(`${FINANCE_API_URL}/resumo`, {
      cache: "no-store",
    });

    if (!resposta.ok) {
      return null;
    }

    const corpo = (await resposta.json()) as RespostaApi;

    return {
      atualizadoEm: corpo.atualizado_em,
      contas: corpo.contas.map((conta) => ({
        id: conta.id,
        nome: conta.nome,
        tipo: conta.tipo,
        saldo: Number(conta.saldo),
        limite: paraNumeroOuNull(conta.limite),
        disponivel: paraNumeroOuNull(conta.disponivel),
      })),
    };
  } catch {
    return null;
  }
}
