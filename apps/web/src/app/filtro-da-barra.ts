import type { Ciclo, Ciclos, FiltroDaApi } from "./buscar-movimentos";
import { comoData, diaEMes } from "./formato";

/**
 * O filtro da barra mora no endereço da página: recarregar ou compartilhar o
 * link cai no mesmo recorte, e quem filtra de verdade é o servidor. Este
 * módulo lê e escreve esse endereço; serve à página e à barra.
 */

export const PERIODOS_DE_CICLO = ["anterior", "atual", "seguinte"] as const;
export type PeriodoDeCiclo = (typeof PERIODOS_DE_CICLO)[number];
export type Periodo = PeriodoDeCiclo | "mes" | "mes-anterior" | "datas";

export type FiltroDaBarra = {
  periodo: Periodo;
  de?: string;
  ate?: string;
  contas: string[];
  categorias: string[];
  comTag?: number;
  semTag?: number;
  /** Data de referência dos ciclos, que o e2e usa para cair na base fictícia. */
  referencia?: string;
};

type Parametros = Record<string, string | string[] | undefined>;

const lista = (valor: string | string[] | undefined) =>
  (Array.isArray(valor) ? valor : valor ? [valor] : []).filter(Boolean);
const um = (valor: string | string[] | undefined) => lista(valor)[0];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const inteiro = (valor: string | undefined) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : undefined;
};

export function lerFiltroDaBarra(parametros: Parametros): FiltroDaBarra {
  const ciclo = um(parametros.ciclo);
  const mes = um(parametros.mes);
  const de = um(parametros.de);
  const ate = um(parametros.ate);
  const periodo: Periodo =
    de && ate && DATA.test(de) && DATA.test(ate) && de <= ate
      ? "datas"
      : mes === "atual"
        ? "mes"
        : mes === "anterior"
          ? "mes-anterior"
          : PERIODOS_DE_CICLO.includes(ciclo as PeriodoDeCiclo)
            ? (ciclo as PeriodoDeCiclo)
            : "atual";
  return {
    periodo,
    ...(periodo === "datas" ? { de, ate } : {}),
    contas: lista(parametros.conta),
    categorias: lista(parametros.categoria),
    comTag: inteiro(um(parametros.com_tag)),
    semTag: inteiro(um(parametros.sem_tag)),
    referencia: um(parametros.referencia),
  };
}

/** O endereço com o filtro, mais o que `extra` acrescenta (a página, por exemplo). */
export function enderecoDoFiltro(
  caminho: string,
  filtro: FiltroDaBarra,
  extra: Record<string, string | number> = {},
): string {
  const query = new URLSearchParams();
  if (filtro.periodo === "datas" && filtro.de && filtro.ate) {
    query.set("de", filtro.de);
    query.set("ate", filtro.ate);
  } else if (filtro.periodo === "mes" || filtro.periodo === "mes-anterior") {
    query.set("mes", filtro.periodo === "mes" ? "atual" : "anterior");
  } else if (filtro.periodo !== "atual") {
    query.set("ciclo", filtro.periodo);
  }
  filtro.contas.forEach((conta) => query.append("conta", conta));
  filtro.categorias.forEach((categoria) =>
    query.append("categoria", categoria),
  );
  if (filtro.comTag) query.set("com_tag", String(filtro.comTag));
  if (filtro.semTag) query.set("sem_tag", String(filtro.semTag));
  if (filtro.referencia) query.set("referencia", filtro.referencia);
  Object.entries(extra).forEach(([chave, valor]) =>
    query.set(chave, String(valor)),
  );
  return query.size > 0 ? `${caminho}?${query}` : caminho;
}

/** Só as duas análises compartilham o recorte, sem levar paginação ou filtros de Tags. */
export function enderecoDaAnalise(
  origem: string,
  destino: string,
  parametros: URLSearchParams,
): string {
  const analises = ["/", "/movimentos"];
  if (!analises.includes(origem) || !analises.includes(destino)) return destino;
  const valores: Parametros = {};
  for (const chave of parametros.keys()) valores[chave] = parametros.getAll(chave);
  return enderecoDoFiltro(destino, lerFiltroDaBarra(valores));
}

/** Conta, categoria ou tag: o que tira a cota, que vale para o gasto todo. */
export function temFiltroDeGasto(filtro: FiltroDaBarra): boolean {
  return (
    filtro.contas.length > 0 ||
    filtro.categorias.length > 0 ||
    Boolean(filtro.comTag || filtro.semTag)
  );
}

export function filtroDaApi(filtro: FiltroDaBarra): FiltroDaApi {
  return {
    contas: filtro.contas,
    categorias: filtro.categorias,
    comTag: filtro.comTag,
    semTag: filtro.semTag,
  };
}

const MES = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});
const iso = (data: Date) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

export type IntervaloDoPeriodo = {
  inicio: string;
  fim: string;
  rotulo: string;
  /** O ciclo, quando o período é um ciclo inteiro. */
  ciclo: Ciclo | null;
  /** O ciclo antes dele, para o comparativo; null quando não se sabe. */
  cicloAnterior: Ciclo | null;
};

export function datasDoCiclo(ciclo: Ciclo): string {
  return `${diaEMes(ciclo.inicio)} a ${diaEMes(ciclo.fim)}`;
}

export function rotuloDoCiclo(
  ciclo: Ciclo,
  nomear: (numero: number) => string = (numero) => `Ciclo ${numero}`,
): string {
  return `${nomear(ciclo.numero)}, ${datasDoCiclo(ciclo)}`;
}

export function intervaloDoPeriodo(
  filtro: FiltroDaBarra,
  ciclos: Ciclos,
  hoje: string,
  nomear?: (numero: number) => string,
): IntervaloDoPeriodo {
  if (filtro.periodo === "datas" && filtro.de && filtro.ate) {
    return {
      inicio: filtro.de,
      fim: filtro.ate,
      rotulo: `${diaEMes(filtro.de)} a ${diaEMes(filtro.ate)}`,
      ciclo: null,
      cicloAnterior: null,
    };
  }
  if (filtro.periodo === "mes" || filtro.periodo === "mes-anterior") {
    const base = comoData(hoje);
    const primeiro = new Date(
      base.getFullYear(),
      base.getMonth() - (filtro.periodo === "mes" ? 0 : 1),
      1,
    );
    const ultimo = new Date(primeiro.getFullYear(), primeiro.getMonth() + 1, 0);
    const nome = MES.format(primeiro);
    return {
      inicio: iso(primeiro),
      fim: iso(ultimo),
      rotulo: nome.charAt(0).toUpperCase() + nome.slice(1),
      ciclo: null,
      cicloAnterior: null,
    };
  }
  // "datas" sem as duas datas não chega aqui: a leitura do endereço cai em "atual".
  const ciclo = ciclos[filtro.periodo === "datas" ? "atual" : filtro.periodo];
  return {
    inicio: ciclo.inicio,
    fim: ciclo.fim,
    rotulo: rotuloDoCiclo(ciclo, nomear),
    ciclo,
    cicloAnterior:
      filtro.periodo === "atual"
        ? ciclos.anterior
        : filtro.periodo === "seguinte"
          ? ciclos.atual
          : null,
  };
}
