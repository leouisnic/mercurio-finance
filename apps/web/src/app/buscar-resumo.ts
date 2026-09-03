export type ResumoTitularidade = {
  id: "pf" | "pj";
  nome: string;
  saldo: number;
};

export type ResumoFinanceiro = {
  atualizadoEm: string;
  titularidades: ResumoTitularidade[];
  obrigacaoDas: {
    competencia: string;
    valor: number;
    paga: boolean;
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
  obrigacao_das: {
    competencia: string;
    valor: string;
    paga: boolean;
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
      obrigacaoDas: {
        competencia: corpo.obrigacao_das.competencia,
        valor: Number(corpo.obrigacao_das.valor),
        paga: corpo.obrigacao_das.paga,
      },
    };
  } catch {
    return null;
  }
}
