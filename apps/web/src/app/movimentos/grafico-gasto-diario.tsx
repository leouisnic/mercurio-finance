import { comoData, diaEMes, moeda } from "../formato";
import type { GastoDiario } from "../buscar-movimentos";

/** Todos os dias do intervalo, inclusive os sem gasto: o gráfico precisa
 *  mostrar o buraco, não pular a coluna. */
function diasDoIntervalo(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  const ultimo = comoData(fim);
  for (let dia = comoData(inicio); dia <= ultimo; dia.setDate(dia.getDate() + 1)) {
    dias.push(
      `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`,
    );
  }
  return dias;
}

const ALTURA_MAXIMA = 100;
const ALTURA_VAZIA = 10;

export function GraficoGastoDiario({
  gastos,
  inicio,
  fim,
  titulo,
}: {
  gastos: GastoDiario[];
  inicio: string;
  fim: string;
  titulo: string;
}) {
  const porDia = new Map(gastos.map((gasto) => [gasto.data, gasto.total]));
  const dias = diasDoIntervalo(inicio, fim);
  const maior = Math.max(...gastos.map((gasto) => gasto.total), 0);
  const total = gastos.reduce((soma, gasto) => soma + gasto.total, 0);

  return (
    <section
      aria-label="Gasto por dia"
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border px-[22px] py-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-tinta-3 text-xs font-semibold tracking-[0.06em] uppercase">{titulo}</h2>
        <span className="num text-tinta-2 text-[13px]">total no período: {moeda(total)}</span>
      </div>

      <ol className="flex h-[124px] items-end gap-2 px-1">
        {dias.map((dia) => {
          const valor = porDia.get(dia) ?? 0;
          const altura = maior > 0 && valor > 0 ? (valor / maior) * ALTURA_MAXIMA : ALTURA_VAZIA;
          return (
            <li
              key={dia}
              title={`${diaEMes(dia)}: ${moeda(valor)}`}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <span
                aria-hidden
                style={{ height: altura }}
                className={`w-full rounded-t-[5px] ${valor > 0 ? "bg-gasto-forte" : "bg-gasto-fundo-fraco"}`}
              />
              <span
                className={`text-[10.5px] ${valor > 0 ? "text-gasto font-semibold" : "text-tinta-3"}`}
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
    </section>
  );
}
