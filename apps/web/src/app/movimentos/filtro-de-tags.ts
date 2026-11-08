import type { Tag } from "../buscar-movimentos";

/**
 * Os filtros da página Tags, no endereço como os da barra: ano e mês pegam a
 * tag cujo período (ou, sem período, o primeiro e o último gasto) passa por
 * eles, para o mês e o ano saírem do nome da tag.
 */

export const SITUACOES = {
  ativas: "Em andamento e encerradas",
  andamento: "Em andamento",
  encerradas: "Encerradas",
  arquivadas: "Arquivadas",
  todas: "Todas",
} as const;
export type Situacao = keyof typeof SITUACOES;

export const TETOS = {
  todos: "Com ou sem teto",
  com: "Com teto",
  passou: "Passou do teto",
  sem: "Sem teto",
} as const;
export type FiltroDeTeto = keyof typeof TETOS;

export type FiltroDeTags = {
  ano?: number;
  mes?: number;
  situacao: Situacao;
  teto: FiltroDeTeto;
  busca: string;
};

type Parametros = Record<string, string | string[] | undefined>;
const um = (valor: string | string[] | undefined) =>
  Array.isArray(valor) ? valor[0] : valor;

export function lerFiltroDeTags(parametros: Parametros): FiltroDeTags {
  const ano = Number(um(parametros.ano));
  const mes = Number(um(parametros.mes));
  const situacao = um(parametros.situacao);
  const teto = um(parametros.teto);
  const anoValido = Number.isInteger(ano) && ano > 1999 ? ano : undefined;
  return {
    ano: anoValido,
    mes:
      anoValido && Number.isInteger(mes) && mes >= 1 && mes <= 12
        ? mes
        : undefined,
    situacao:
      situacao && situacao in SITUACOES ? (situacao as Situacao) : "ativas",
    teto: teto && teto in TETOS ? (teto as FiltroDeTeto) : "todos",
    busca: (um(parametros.busca) ?? "").trim().slice(0, 60),
  };
}

export function enderecoDosFiltrosDeTags(filtro: FiltroDeTags): string {
  const query = new URLSearchParams();
  if (filtro.ano) query.set("ano", String(filtro.ano));
  if (filtro.ano && filtro.mes) query.set("mes", String(filtro.mes));
  if (filtro.situacao !== "ativas") query.set("situacao", filtro.situacao);
  if (filtro.teto !== "todos") query.set("teto", filtro.teto);
  if (filtro.busca) query.set("busca", filtro.busca);
  return query.size > 0 ? `/movimentos/tags?${query}` : "/movimentos/tags";
}

/** O período da tag: o declarado, ou do primeiro ao último gasto. */
function periodoDaTag(tag: Tag): [string, string] | null {
  const inicio = tag.inicio ?? tag.primeiraData;
  const fim = tag.fim ?? tag.ultimaData ?? inicio;
  return inicio && fim ? [inicio, fim] : null;
}

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function situacaoDaTag(
  tag: Tag,
  hoje: string,
): "andamento" | "encerradas" | "arquivadas" {
  if (tag.arquivada) return "arquivadas";
  return tag.fim !== null && tag.fim < hoje ? "encerradas" : "andamento";
}

export function filtrarTags(
  tags: Tag[],
  filtro: FiltroDeTags,
  hoje: string,
): Tag[] {
  return tags.filter((tag) => {
    const situacao = situacaoDaTag(tag, hoje);
    if (
      filtro.situacao === "ativas"
        ? situacao === "arquivadas"
        : filtro.situacao !== "todas" && situacao !== filtro.situacao
    ) {
      return false;
    }
    if (filtro.teto === "com" && tag.teto === null) return false;
    if (filtro.teto === "sem" && tag.teto !== null) return false;
    if (
      filtro.teto === "passou" &&
      (tag.teto === null || tag.gasto <= tag.teto)
    )
      return false;
    if (filtro.busca && !semAcento(tag.nome).includes(semAcento(filtro.busca)))
      return false;
    if (filtro.ano) {
      const periodo = periodoDaTag(tag);
      if (!periodo) return false;
      const mes = filtro.mes ? String(filtro.mes).padStart(2, "0") : null;
      const inicio = mes ? `${filtro.ano}-${mes}-01` : `${filtro.ano}-01-01`;
      const fim = mes ? `${filtro.ano}-${mes}-31` : `${filtro.ano}-12-31`;
      if (periodo[1] < inicio || periodo[0] > fim) return false;
    }
    return true;
  });
}

/** Os anos em que alguma tag tem período ou gasto, do mais novo para o mais antigo. */
export function anosDasTags(tags: Tag[]): number[] {
  const anos = new Set<number>();
  for (const tag of tags) {
    const periodo = periodoDaTag(tag);
    if (!periodo) continue;
    for (
      let ano = Number(periodo[0].slice(0, 4));
      ano <= Number(periodo[1].slice(0, 4));
      ano++
    )
      anos.add(ano);
  }
  return [...anos].sort((a, b) => b - a);
}
