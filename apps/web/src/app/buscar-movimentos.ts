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

/** Um dos maiores gastos do dia, para o detalhe do gráfico. */
export type GastoDoDetalhe = { descricao: string; valor: number };

export type GastoDiario = {
  data: string;
  total: number;
  emRevisao: number;
  maiores: GastoDoDetalhe[];
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

/** `icone` e `cor` como na categoria; `teto`, `inicio` e `fim` são opcionais. */
export type Tag = {
  id: number;
  nome: string;
  icone: string;
  cor: number;
  teto: number | null;
  inicio: string | null;
  fim: string | null;
  arquivada: boolean;
  gasto: number;
  quantidade: number;
  primeiraData: string | null;
  ultimaData: string | null;
};

export type CicloDoImpacto = { numero: number; inicio: string; fim: string };

/** Ver `finance_api.tags` para a regra do típico, do rombo e da recuperação. */
export type ResumoDaTag = Tag & {
  porCategoria: { categoria: string | null; total: number }[];
  dias: number;
  porDia: number;
  maiores: { data: string; descricao: string; valor: number }[];
  diaMaisCaro: { data: string; total: number } | null;
  acumulado: { data: string; total: number }[];
  categoriaPrincipal: { categoria: string; total: number; tipicoPorCiclo: number | null } | null;
  impacto: {
    ciclo: CicloDoImpacto;
    gasto: number;
    tipico: number;
    rombo: number;
    romboDaTag: number;
    sobraMedia: number;
    ciclosParaRecuperar: number | null;
    barras: { ciclo: CicloDoImpacto; gastoSemATag: number; gastoDaTag: number }[];
  } | null;
};

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
  type Linha = { data: string; total: string; em_revisao: string; maiores?: { descricao: string; valor: string }[] };
  const corpo = await buscarJson<Linha[]>("/movimentos/gastos-diarios", {
    data_inicio: inicio,
    data_fim: fim,
    conta_id: contaId,
  });
  return corpo?.map((linha) => ({
    data: linha.data,
    total: paraNumero(linha.total),
    emRevisao: paraNumero(linha.em_revisao),
    maiores: (linha.maiores ?? []).map((item) => ({ descricao: item.descricao, valor: paraNumero(item.valor) })),
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
  icone: string;
  cor: number;
  teto: string | null;
  inicio: string | null;
  fim: string | null;
  arquivada: boolean;
  gasto: string;
  quantidade: number;
  primeira_data: string | null;
  ultima_data: string | null;
};

function comoTag(linha: LinhaDeTag): Tag {
  return {
    id: linha.id,
    nome: linha.nome,
    icone: linha.icone,
    cor: linha.cor,
    teto: linha.teto === null ? null : paraNumero(linha.teto),
    inicio: linha.inicio,
    fim: linha.fim,
    arquivada: linha.arquivada,
    gasto: paraNumero(linha.gasto),
    quantidade: linha.quantidade,
    primeiraData: linha.primeira_data,
    ultimaData: linha.ultima_data,
  };
}

export async function buscarTags(): Promise<Tag[] | null> {
  return (await buscarJson<LinhaDeTag[]>("/tags"))?.map(comoTag) ?? null;
}

type ValorDoCiclo = { numero: number; inicio: string; fim: string };
type LinhaDoResumo = LinhaDeTag & {
  por_categoria: { categoria: string | null; total: string }[];
  dias: number;
  por_dia: string;
  maiores: { data: string; descricao: string; valor: string }[];
  dia_mais_caro: { data: string; total: string } | null;
  acumulado: { data: string; total: string }[];
  categoria_principal: { categoria: string; total: string; tipico_por_ciclo: string | null } | null;
  impacto: {
    ciclo: ValorDoCiclo;
    gasto: string;
    tipico: string;
    rombo: string;
    rombo_da_tag: string;
    sobra_media: string;
    ciclos_para_recuperar: number | null;
    barras: { ciclo: ValorDoCiclo; gasto_sem_a_tag: string; gasto_da_tag: string }[];
  } | null;
};

export async function buscarResumoDaTag(id: number, hoje?: string): Promise<ResumoDaTag | null> {
  const corpo = await buscarJson<LinhaDoResumo>(`/tags/${id}`, { hoje });
  if (corpo === null) {
    return null;
  }
  const impacto = corpo.impacto;
  return {
    ...comoTag(corpo),
    porCategoria: corpo.por_categoria.map((item) => ({ categoria: item.categoria, total: paraNumero(item.total) })),
    dias: corpo.dias,
    porDia: paraNumero(corpo.por_dia),
    maiores: corpo.maiores.map((item) => ({ ...item, valor: paraNumero(item.valor) })),
    diaMaisCaro: corpo.dia_mais_caro
      ? { data: corpo.dia_mais_caro.data, total: paraNumero(corpo.dia_mais_caro.total) }
      : null,
    acumulado: corpo.acumulado.map((item) => ({ data: item.data, total: paraNumero(item.total) })),
    categoriaPrincipal: corpo.categoria_principal
      ? {
          categoria: corpo.categoria_principal.categoria,
          total: paraNumero(corpo.categoria_principal.total),
          tipicoPorCiclo:
            corpo.categoria_principal.tipico_por_ciclo === null
              ? null
              : paraNumero(corpo.categoria_principal.tipico_por_ciclo),
        }
      : null,
    impacto: impacto
      ? {
          ciclo: impacto.ciclo,
          gasto: paraNumero(impacto.gasto),
          tipico: paraNumero(impacto.tipico),
          rombo: paraNumero(impacto.rombo),
          romboDaTag: paraNumero(impacto.rombo_da_tag),
          sobraMedia: paraNumero(impacto.sobra_media),
          ciclosParaRecuperar: impacto.ciclos_para_recuperar,
          barras: impacto.barras.map((barra) => ({
            ciclo: barra.ciclo,
            gastoSemATag: paraNumero(barra.gasto_sem_a_tag),
            gastoDaTag: paraNumero(barra.gasto_da_tag),
          })),
        }
      : null,
  };
}

export async function buscarParaClassificar(hoje: string): Promise<number | null> {
  return (await buscarJson<{ total: number }>("/movimentos/para-classificar", { hoje }))?.total ?? null;
}
