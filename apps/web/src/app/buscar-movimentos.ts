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
  apelido: string | null;
  tipo: "BANK" | "CREDIT";
  entradas: number;
  saidas: number;
  emRevisao: number;
  /** O que mexe no saldo sem ser gasto: fatura paga e transferência entre
   *  contas do titular (inclui aplicação e resgate). */
  faturaPaga?: number;
  transferenciasEntrada?: number;
  transferenciasSaida?: number;
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
  /** Categoria do Mercúrio. Nula em receita ou despesa é "para classificar". */
  categoriaPropria: string | null;
  origemDaCategoria: "dono" | "mobills" | "regra" | "pluggy" | null;
  /** Só na fila para classificar: o que o dono já deu ao mesmo destinatário. */
  historico: { categoria: string; vezes: number }[];
  tags: string[];
};

/** `icone` é o nome no lucide-react; `cor` é só o tom, de 0 a 359. */
export type Categoria = { id: string; nome: string; icone: string; cor: number };

export type Tag = {
  id: number;
  nome: string;
  gasto: number;
  quantidade: number;
  primeiraData: string | null;
  ultimaData: string | null;
};

export type ResumoDaTag = Tag & { porCategoria: { categoria: string | null; total: number }[] };

/** Só receita e despesa levam categoria, e pagamento de fatura não. */
export function levaCategoria(movimento: Movimento): boolean {
  return (
    ["despesa", "receita"].includes(movimento.tipo) &&
    (movimento.pagamentoDeFatura === null || movimento.pagamentoDeFatura === "descartado")
  );
}

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
    apelido: string | null;
    tipo: "BANK" | "CREDIT";
    entradas: string;
    saidas: string;
    em_revisao: string;
    fatura_paga?: string;
    transferencias_entrada?: string;
    transferencias_saida?: string;
  };
  const corpo = await buscarJson<Linha[]>("/movimentos/por-conta", {
    data_inicio: inicio,
    data_fim: fim,
  });
  return (
    corpo?.map((linha) => ({
      contaId: linha.conta_id,
      nome: linha.nome,
      apelido: linha.apelido,
      tipo: linha.tipo,
      entradas: paraNumero(linha.entradas),
      saidas: paraNumero(linha.saidas),
      emRevisao: paraNumero(linha.em_revisao),
      faturaPaga: paraNumero(linha.fatura_paga ?? "0"),
      transferenciasEntrada: paraNumero(linha.transferencias_entrada ?? "0"),
      transferenciasSaida: paraNumero(linha.transferencias_saida ?? "0"),
    })) ?? null
  );
}

/** Com `paraClassificar` e sem `inicio`, a API devolve a fila dos ciclos
 *  recentes contados a partir de `hoje`. */
export async function buscarMovimentos(
  inicio: string | undefined,
  fim: string | undefined,
  contaId?: string,
  limite = 50,
  offset = 0,
  paraClassificar = false,
  hoje?: string,
  tagId?: number,
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
    categoria_propria?: string | null;
    origem_da_categoria?: Movimento["origemDaCategoria"];
    historico?: { categoria: string; vezes: number }[];
    tags?: string[];
  };
  const corpo = await buscarJson<Linha[]>("/movimentos", {
    data_inicio: inicio,
    data_fim: fim,
    conta_id: contaId,
    para_classificar: paraClassificar ? "true" : undefined,
    hoje,
    tag_id: tagId,
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
      categoriaPropria: linha.categoria_propria ?? null,
      origemDaCategoria: linha.origem_da_categoria ?? null,
      historico: linha.historico ?? [],
      tags: linha.tags ?? [],
    })) ?? null
  );
}

export async function buscarCategorias(): Promise<Categoria[] | null> {
  return buscarJson<Categoria[]>("/categorias");
}

type LinhaDeTag = {
  id: number;
  nome: string;
  gasto: string;
  quantidade: number;
  primeira_data: string | null;
  ultima_data: string | null;
};

function comoTag(linha: LinhaDeTag): Tag {
  return {
    id: linha.id,
    nome: linha.nome,
    gasto: paraNumero(linha.gasto),
    quantidade: linha.quantidade,
    primeiraData: linha.primeira_data,
    ultimaData: linha.ultima_data,
  };
}

export async function buscarTags(): Promise<Tag[] | null> {
  return (await buscarJson<LinhaDeTag[]>("/tags"))?.map(comoTag) ?? null;
}

export async function buscarResumoDaTag(id: number): Promise<ResumoDaTag | null> {
  const corpo = await buscarJson<LinhaDeTag & { por_categoria: { categoria: string | null; total: string }[] }>(
    `/tags/${id}`,
  );
  return corpo
    ? {
        ...comoTag(corpo),
        porCategoria: corpo.por_categoria.map((item) => ({
          categoria: item.categoria,
          total: paraNumero(item.total),
        })),
      }
    : null;
}

export async function buscarParaClassificar(hoje: string): Promise<number | null> {
  return (await buscarJson<{ total: number }>("/movimentos/para-classificar", { hoje }))?.total ?? null;
}
