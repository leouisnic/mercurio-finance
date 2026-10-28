import { ChartColumn } from "lucide-react";
import { comoData, diaEMes, moeda } from "../formato";
import { Info } from "../info";

type Dia = { data: string; rotulo: string; valor: number; futuro: boolean };

function diasDoCiclo(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  const ultimo = comoData(fim);
  const doisDigitos = (valor: number) => String(valor).padStart(2, "0");
  for (let dia = comoData(inicio); dia <= ultimo; dia.setDate(dia.getDate() + 1)) {
    dias.push(`${dia.getFullYear()}-${doisDigitos(dia.getMonth() + 1)}-${doisDigitos(dia.getDate())}`);
  }
  return dias;
}

/**
 * Topo da escala do gráfico. Um dia muito acima dos outros (o aluguel pago no
 * débito, uma compra grande) achataria todas as barras e a cota contra o
 * chão; quando o maior passa de 2,5 vezes o segundo maior (ou a cota), ele é
 * cortado no teto e ganha o valor escrito.
 */
export function tetoDaEscala(valores: number[], cota: number): number {
  const ordenados = [...valores].sort((a, b) => b - a);
  const maior = ordenados[0] ?? 0;
  const base = Math.max(ordenados[1] ?? 0, cota);
  if (base > 0 && maior > base * 2.5) {
    return base * 1.25;
  }
  return Math.max(maior, cota, 1) * 1.1;
}

const CORTE = "repeating-linear-gradient(135deg, var(--color-superficie) 0 3px, transparent 3px 6px)";

/**
 * Gasto de cada dia do ciclo contra a cota. Os dias que ainda não chegaram
 * aparecem pontilhados na altura da cota; o dia que passou dela, em vermelho.
 */
export function GraficoDoCiclo({
  inicio,
  fim,
  hoje,
  cota,
  gastos,
}: {
  inicio: string;
  fim: string;
  hoje: string;
  cota: number;
  gastos: { data: string; total: number }[];
}) {
  const porDia = new Map(gastos.map((gasto) => [gasto.data, gasto.total]));
  const cotaVisivel = Math.max(cota, 0);
  const dados: Dia[] = diasDoCiclo(inicio, fim).map((data) => {
    const futuro = data > hoje;
    return {
      data,
      rotulo: data === hoje ? "hoje" : data.slice(8, 10),
      valor: futuro ? cotaVisivel : (porDia.get(data) ?? 0),
      futuro,
    };
  });
  const passados = dados.filter((dia) => !dia.futuro);
  const teto = tetoDaEscala(
    passados.map((dia) => dia.valor),
    cotaVisivel,
  );
  const algumCortado = passados.some((dia) => dia.valor > teto);
  const alturaDaCota = (cotaVisivel / teto) * 100;

  return (
    <section
      aria-label="Gasto por dia e cota"
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border p-4"
    >
      <div className="flex items-center gap-2.5">
        <span className="bg-marca-clara text-marca grid size-[30px] shrink-0 place-items-center rounded-[9px]">
          <ChartColumn size={18} strokeWidth={2} aria-hidden />
        </span>
        <h2 className="text-sm font-bold">Gasto por dia</h2>
        <Info
          sobre="gasto por dia"
          texto="Sem contas fixas e fatura. A linha tracejada é a cota."
        />
      </div>

      <span className="bg-marca-clara text-marca self-start rounded-full px-3 py-1 text-[13px] font-bold">
        Cota do dia <span className="num">{moeda(cota)}</span>
      </span>

      <div aria-hidden className="relative pt-[26px]">
        <div className="relative grid h-[170px] gap-1" style={{ gridTemplateColumns: `repeat(${dados.length}, minmax(0, 1fr))` }}>
          <div
            className="border-marca pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed"
            style={{ bottom: `${alturaDaCota}%` }}
          />
          {dados.map((dia) => {
            const cortado = !dia.futuro && dia.valor > teto;
            const altura = (Math.min(dia.valor, teto) / teto) * 100;
            const passou = !dia.futuro && dia.valor > cotaVisivel;
            return (
              <div
                key={dia.data}
                title={dia.futuro ? undefined : `${diaEMes(dia.data)}: ${moeda(dia.valor)}`}
                className="border-borda flex items-end justify-center border-b"
              >
                {dia.futuro ? (
                  <span
                    className="border-tinta-4 block w-[70%] max-w-[30px] rounded-t border-[1.5px] border-b-0 border-dashed"
                    style={{ height: `${alturaDaCota}%` }}
                  />
                ) : (
                  <span
                    className={`relative block w-[70%] max-w-[30px] rounded-t ${passou ? "bg-alerta-forte" : "bg-tinta-4"}`}
                    style={{ height: `${Math.max(altura, 1.5)}%` }}
                  >
                    {cortado ? (
                      <>
                        <span className="num text-alerta absolute -top-[22px] left-0 text-xs font-bold whitespace-nowrap">
                          {moeda(dia.valor)}
                        </span>
                        <span className="absolute inset-x-[-3px] top-3.5 h-2" style={{ background: CORTE }} />
                      </>
                    ) : (
                      passou && (
                        <span className="num text-tinta-2 absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap max-sm:hidden">
                          {Math.round(dia.valor)}
                        </span>
                      )
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${dados.length}, minmax(0, 1fr))` }}>
          {dados.map((dia, indice) => (
            <span
              key={dia.data}
              className={`text-center text-xs ${dia.rotulo === "hoje" ? "text-marca font-bold" : "text-tinta-3"} ${
                dia.rotulo === "hoje" || indice % 3 === 0 ? "" : "max-sm:invisible"
              }`}
            >
              {dia.rotulo}
            </span>
          ))}
        </div>
      </div>

      <div className="text-tinta-2 flex flex-wrap gap-x-[18px] gap-y-1.5 text-sm" aria-hidden>
        <span className="flex items-center gap-1.5">
          <i className="bg-tinta-4 inline-block size-[11px] rounded-[3px]" />
          Dentro da cota
        </span>
        <span className="flex items-center gap-1.5">
          <i className="bg-alerta-forte inline-block size-[11px] rounded-[3px]" />
          Passou da cota
        </span>
        {algumCortado && (
          <span className="flex items-center gap-1.5">
            <i
              className="inline-block size-[11px] rounded-[3px]"
              style={{
                background:
                  "repeating-linear-gradient(135deg, var(--color-alerta-forte) 0 3px, var(--color-superficie) 3px 5px)",
              }}
            />
            Fora da escala, valor escrito
          </span>
        )}
      </div>

      <table className="sr-only">
        <caption>Gasto por dia do ciclo, cota de {moeda(cota)}</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Gasto</th>
          </tr>
        </thead>
        <tbody>
          {passados.map((dia) => (
            <tr key={dia.data}>
              <td>{diaEMes(dia.data)}</td>
              <td>
                {moeda(dia.valor)}
                {dia.valor > cota ? ", acima da cota" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
