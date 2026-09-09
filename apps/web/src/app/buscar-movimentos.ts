import { buscarJson, paraNumero } from "./api";

export type Ciclo = {
  numero: number;
  inicio: string;
  fim: string;
};

export type Ciclos = {
  atual: Ciclo;
  anterior: Ciclo;
  seguinte: Ciclo;
};

export type GastoDiario = {
  data: string;
  total: number;
  emRevisao: number;
};

export type FluxoDaConta = {
  contaId: string;
  nome: string;
  tipo: "BANK" | "CREDIT";
  entradas: number;
  saidas: number;
  emRevisao: number;
};

export type Movimento = {
  id: number;
  contaId: string;
  data: string;
  valor: number;
  descricao: string;
  tipo: string;
  categoria: string | null;
  duplicadoPossivel: boolean;
  pagamentoDeFatura: string | null;
};

/**
 * O ciclo de pagamento que contém `referencia`, mais o anterior e o
 * seguinte. Quem calcula é o finance-api: a regra depende do calendário de
 * dias não úteis e não é replicada aqui.
 */
export async function buscarCiclos(referencia?: string): Promise<Ciclos | null> {
  return buscarJson<Ciclos>("/ciclos", { referencia });
}

export async function buscarGastosDiarios(
  inicio: string,
  fim: string,
  contaId?: string,
): Promise<GastoDiario[] | null> {
  const corpo = await buscarJson<{ data: string; total: string; em_revisao: string }[]>("/movimentos/gastos-diarios", {
    data_inicio: inicio,
    data_fim: fim,
    conta_id: contaId,
  });
  return corpo?.map((linha) => ({
    data: linha.data,
    total: paraNumero(linha.total),
    emRevisao: paraNumero(linha.em_revisao),
  })) ?? null;
}

export async function buscarFluxoPorConta(
  inicio: string,
  fim: string,
): Promise<FluxoDaConta[] | null> {
  type Linha = {
    conta_id: string;
    nome: string;
    tipo: "BANK" | "CREDIT";
    entradas: string;
    saidas: string;
    em_revisao: string;
  };
  const corpo = await buscarJson<Linha[]>("/movimentos/por-conta", {
    data_inicio: inicio,
    data_fim: fim,
  });
  return (
    corpo?.map((linha) => ({
      contaId: linha.conta_id,
      nome: linha.nome,
      tipo: linha.tipo,
      entradas: paraNumero(linha.entradas),
      saidas: paraNumero(linha.saidas),
      emRevisao: paraNumero(linha.em_revisao),
    })) ?? null
  );
}

export async function buscarMovimentos(
  inicio: string,
  fim: string,
  contaId?: string,
  limite = 50,
  offset = 0,
): Promise<Movimento[] | null> {
  type Linha = {
    id: number;
    conta_id: string;
    data: string;
    valor: string;
    descricao: string;
    tipo: string;
    categoria: string | null;
    duplicado_possivel: boolean;
    pagamento_de_fatura: string | null;
  };
  const corpo = await buscarJson<Linha[]>("/movimentos", {
    data_inicio: inicio,
    data_fim: fim,
    conta_id: contaId,
    limite,
    offset,
  });
  return (
    corpo?.map((linha) => ({
      id: linha.id,
      contaId: linha.conta_id,
      data: linha.data,
      valor: paraNumero(linha.valor),
      descricao: linha.descricao,
      tipo: linha.tipo,
      categoria: linha.categoria,
      duplicadoPossivel: linha.duplicado_possivel,
      pagamentoDeFatura: linha.pagamento_de_fatura,
    })) ?? null
  );
}
