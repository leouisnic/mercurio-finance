"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  const dados: Dia[] = diasDoCiclo(inicio, fim).map((data) => {
    const futuro = data > hoje;
    return {
      data,
      rotulo: data === hoje ? "hoje" : data.slice(8, 10),
      valor: futuro ? Math.max(cota, 0) : (porDia.get(data) ?? 0),
      futuro,
    };
  });
  const passados = dados.filter((dia) => !dia.futuro);

  return (
    <section
      aria-label="Gasto por dia e cota"
      className="bg-superficie border-borda flex flex-col gap-3 rounded-2xl border px-5 py-4"
    >
      <div className="flex items-center gap-1">
        <h2 className="text-tinta-3 text-xs font-semibold tracking-[0.06em] uppercase">Gasto por dia e cota</h2>
        <Info
          sobre="gasto por dia e cota"
          texto="Quanto saiu em cada dia do ciclo, sem contas fixas e fatura. A linha tracejada é a cota do dia."
        />
      </div>

      <div aria-hidden className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          {/* Sem a camada de teclado do Recharts: o gráfico fica escondido de
              leitor de tela, e a tabela abaixo é o equivalente acessível. */}
          <BarChart
            data={dados}
            margin={{ top: 18, right: 4, bottom: 0, left: 4 }}
            barCategoryGap="22%"
            accessibilityLayer={false}
          >
            <XAxis
              dataKey="rotulo"
              tickLine={false}
              axisLine={{ stroke: "var(--color-borda)" }}
              tick={({ x, y, payload }) => (
                <text
                  x={x}
                  y={Number(y) + 12}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={payload.value === "hoje" ? 600 : 400}
                  fill={payload.value === "hoje" ? "var(--color-marca)" : "var(--color-tinta-3)"}
                >
                  {payload.value}
                </text>
              )}
              interval={0}
            />
            <YAxis hide domain={[0, (maior: number) => Math.max(maior, cota) * 1.15]} />
            <Tooltip
              cursor={{ fill: "var(--color-superficie-2)" }}
              formatter={(valor, _nome, item) => [
                moeda(Number(valor)),
                (item.payload as Dia).futuro ? "cota" : "gasto",
              ]}
              labelFormatter={(_rotulo, itens) => {
                const dia = itens[0]?.payload as Dia | undefined;
                return dia ? diaEMes(dia.data) : "";
              }}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {dados.map((dia) => (
                <Cell
                  key={dia.data}
                  fill={
                    dia.futuro
                      ? "transparent"
                      : dia.valor > cota
                        ? "var(--color-alerta-forte)"
                        : "var(--color-tinta-4)"
                  }
                  stroke={dia.futuro ? "var(--color-tinta-4)" : undefined}
                  strokeDasharray={dia.futuro ? "3 3" : undefined}
                />
              ))}
            </Bar>
            <ReferenceLine
              y={cota}
              stroke="var(--color-tinta-2)"
              strokeWidth={2}
              strokeDasharray="6 4"
              label={{
                value: `cota ${moeda(cota)}`,
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--color-tinta-2)",
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="text-tinta-2 flex flex-wrap gap-4 text-xs" aria-hidden>
        <span className="flex items-center gap-1.5">
          <i className="bg-tinta-4 inline-block size-[9px] rounded-[3px]" />
          gasto do dia
        </span>
        <span className="flex items-center gap-1.5">
          <i className="bg-alerta-forte inline-block size-[9px] rounded-[3px]" />
          passou da cota
        </span>
        <span className="flex items-center gap-1.5">
          <i className="border-tinta-2 inline-block w-[18px] border-t-2 border-dashed" />
          cota do dia
        </span>
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
