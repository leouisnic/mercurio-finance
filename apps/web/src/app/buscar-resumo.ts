export type ResumoTitularidade = {
  id: "pf" | "pj";
  nome: string;
  saldo: number;
};

export type ResumoFinanceiro = {
  atualizadoEm: string;
  titularidades: ResumoTitularidade[];
  reservaDas: {
    referencia: string;
    valorReservado: number;
    valorPrevisto: number;
  };
};

type RespostaApiTitularidade = {
  titularidade: "pf" | "pj";
  nome: string;
  saldo: string;
};

type RespostaApi = {
  atualizado_em: string;
  titularidades: RespostaApiTitularidade[];
  reserva_das: {
    referencia: string;
    valor_reservado: string;
    valor_previsto: string;
  };
};

const FINANCE_API_URL = process.env.FINANCE_API_URL ?? "http://localhost:8000";

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
      titularidades: corpo.titularidades.map((item) => ({
        id: item.titularidade,
        nome: item.nome,
        saldo: Number(item.saldo),
      })),
      reservaDas: {
        referencia: corpo.reserva_das.referencia,
        valorReservado: Number(corpo.reserva_das.valor_reservado),
        valorPrevisto: Number(corpo.reserva_das.valor_previsto),
      },
    };
  } catch {
    return null;
  }
}
