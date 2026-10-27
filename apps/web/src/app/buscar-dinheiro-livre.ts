import { buscarJson, paraNumero } from "./api";
import type { Ciclo } from "./buscar-movimentos";

export type ContaFixa = {
  nome: string;
  valor: number;
  dataPrevista: string;
  origem: "recorrencia" | "compromisso";
  atrasada: boolean;
};

export type DinheiroLivre = {
  hoje: string;
  ciclo: Ciclo;
  cicloSeguinte: Ciclo;
  saldoContas: number;
  cartaoUsado: number;
  contasFixas: ContaFixa[];
  contasFixasTotal: number;
  caixinha: number;
  livre: number;
  diasDoCiclo: number;
  diasRestantes: number;
  cotaDoDia: number;
  cofrinho: number;
  gastoHoje: number;
  hojeDisponivel: number;
  gastosPorDia: { data: string; total: number }[];
};

type Resposta = {
  hoje: string;
  ciclo: Ciclo;
  ciclo_seguinte: Ciclo;
  saldo_contas: string;
  cartao_usado: string;
  contas_fixas: {
    nome: string;
    valor: string;
    data_prevista: string;
    origem: "recorrencia" | "compromisso";
    atrasada: boolean;
  }[];
  contas_fixas_total: string;
  caixinha: string;
  livre: string;
  dias_do_ciclo: number;
  dias_restantes: number;
  cota_do_dia: string;
  cofrinho: string;
  gasto_hoje: string;
  hoje_disponivel: string;
  gastos_por_dia: { data: string; total: string }[];
};

/** Quanto dá para gastar até a véspera do próximo pagamento. A conta é da
 *  API (`finance_api.dinheiro_livre`); a tela só mostra. */
export async function buscarDinheiroLivre(hoje: string): Promise<DinheiroLivre | null> {
  const corpo = await buscarJson<Resposta>("/dinheiro-livre", { hoje });
  if (corpo === null) {
    return null;
  }
  return {
    hoje: corpo.hoje,
    ciclo: corpo.ciclo,
    cicloSeguinte: corpo.ciclo_seguinte,
    saldoContas: paraNumero(corpo.saldo_contas),
    cartaoUsado: paraNumero(corpo.cartao_usado),
    contasFixas: corpo.contas_fixas.map((conta) => ({
      nome: conta.nome,
      valor: paraNumero(conta.valor),
      dataPrevista: conta.data_prevista,
      origem: conta.origem,
      atrasada: conta.atrasada,
    })),
    contasFixasTotal: paraNumero(corpo.contas_fixas_total),
    caixinha: paraNumero(corpo.caixinha),
    livre: paraNumero(corpo.livre),
    diasDoCiclo: corpo.dias_do_ciclo,
    diasRestantes: corpo.dias_restantes,
    cotaDoDia: paraNumero(corpo.cota_do_dia),
    cofrinho: paraNumero(corpo.cofrinho),
    gastoHoje: paraNumero(corpo.gasto_hoje),
    hojeDisponivel: paraNumero(corpo.hoje_disponivel),
    gastosPorDia: corpo.gastos_por_dia.map((dia) => ({ data: dia.data, total: paraNumero(dia.total) })),
  };
}
