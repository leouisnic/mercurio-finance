import type { GastoDiario } from "../buscar-movimentos";
import { ColunaComDetalhe } from "../detalhe-do-grafico";
import { comoData, diaEMes, moeda, moedaCurta } from "../formato";

/** Todos os dias do intervalo, inclusive os sem gasto: o gráfico precisa
 *  mostrar o buraco, não pular a coluna. */
function diasDoIntervalo(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  const ultimo = comoData(fim);
  for (
    let dia = comoData(inicio);
    dia <= ultimo;
    dia.setDate(dia.getDate() + 1)
  ) {
    dias.push(
      `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`,
    );
  }
  return dias;
}

const ALTURA_MAXIMA = 100;
const ALTURA_VAZIA = 6;

/**
 * As cores do Início: dourado sem gasto, índigo com gasto e, só no ciclo
 * atual, vermelho acima da cota. Ciclo passado não tem cota guardada, então
 * fica sem linha e sem vermelho. Os dias depois de `hoje` ficam vazios.
 */
export function GraficoGastoDiario({
  gastos,
  inicio,
  fim,
  titulo,
  cota = null,
  hoje = null,
}: {
  gastos: GastoDiario[];
  inicio: string;
  fim: string;
  titulo: string;
  cota?: number | null;
  hoje?: string | null;
}) {
  const porDia = new Map(gastos.map((gasto) => [gasto.data, gasto]));
  const dias = diasDoIntervalo(inicio, fim);
  const maior = Math.max(...gastos.map((gasto) => gasto.total), cota ?? 0, 0);
  const total = gastos.reduce((soma, gasto) => soma + gasto.total, 0);

  return (
    <section
      aria-label="Gasto por dia"
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border px-[22px] py-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">{titulo}</h2>
        <span className="num text-tinta-2 text-[13px]">
          total no período: {moeda(total)}
        </span>
      </div>

      <div className="relative pt-5">
        {cota !== null && maior > 0 && (
          <div
            aria-hidden
            className="border-marca pointer-events-none absolute inset-x-1 z-10 border-t-2 border-dashed"
            style={{
              bottom: `calc(${(cota / maior) * ALTURA_MAXIMA}px + 26px)`,
            }}
          />
        )}
        <ol className="flex h-[124px] items-end gap-1 px-1 sm:gap-2">
          {dias.map((dia, indice) => {
            const futuro = hoje !== null && dia > hoje;
            const gasto = porDia.get(dia);
            const valor = gasto?.total ?? 0;
            const passou = cota !== null && valor > cota;
            const altura =
              maior > 0 && valor > 0
                ? (valor / maior) * ALTURA_MAXIMA
                : ALTURA_VAZIA;
            const cor =
              valor === 0
                ? "bg-caixinha"
                : passou
                  ? "bg-alerta-forte"
                  : "bg-marca";
            return (
              <li
                key={dia}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              >
                {futuro ? (
                  <span className="block" style={{ height: ALTURA_VAZIA }} />
                ) : (
                  <ColunaComDetalhe
                    data={dia}
                    valor={valor}
                    cota={cota}
                    maiores={gasto?.maiores ?? []}
                  >
                    <span
                      className={`relative block w-full rounded-t-[5px] transition-opacity group-hover:opacity-80 ${cor}`}
                      style={{ height: altura }}
                    >
                      {valor > 0 && (
                        <span
                          className={`num bg-superficie absolute -top-5 left-1/2 z-20 -translate-x-1/2 rounded px-1 text-[11px] font-bold whitespace-nowrap max-lg:hidden ${
                            passou ? "text-alerta" : "text-tinta-2"
                          }`}
                        >
                          {moedaCurta(valor)}
                        </span>
                      )}
                    </span>
                  </ColunaComDetalhe>
                )}
                <span
                  className={`text-xs sm:text-[13px] ${valor > 0 ? "text-tinta font-semibold" : "text-tinta-3"} ${
                    // No celular não cabe um rótulo por dia: fica um a cada três.
                    indice % 3 === 0 ? "" : "max-sm:invisible"
                  }`}
                >
                  {dia.slice(8, 10)}
                </span>
                <span className="sr-only">
                  {diaEMes(dia)}: {moeda(valor)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div
        className="text-tinta-2 flex flex-wrap gap-x-[18px] gap-y-1.5 text-sm"
        aria-hidden
      >
        <span className="flex items-center gap-1.5">
          <i className="bg-caixinha inline-block size-[11px] rounded-[3px]" />
          Sem gasto
        </span>
        <span className="flex items-center gap-1.5">
          <i className="bg-marca inline-block size-[11px] rounded-[3px]" />
          {cota === null ? "Com gasto" : "Dentro da cota"}
        </span>
        {cota !== null && (
          <span className="flex items-center gap-1.5">
            <i className="bg-alerta-forte inline-block size-[11px] rounded-[3px]" />
            Passou da cota
          </span>
        )}
      </div>
    </section>
  );
}
