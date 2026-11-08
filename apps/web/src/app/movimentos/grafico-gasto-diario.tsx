import { type DiaNaoUtil, marcaDoDia } from "../buscar-feriados";
import type { GastoDiario } from "../buscar-movimentos";
import { ColunaComDetalhe } from "../detalhe-do-grafico";
import { maiorDia, mediaPorDia, projecao } from "../analise-do-grafico";
import {
  AreaDaProjecao,
  DiaDoEixo,
  LegendaDosDias,
  LinhaDaCota,
  LinhaDaMedia,
} from "../dias-do-grafico";
import { BARRA_DA_PROJECAO, LISTRAS_DO_MAIOR_DIA } from "../estilos-do-grafico";
import { comoData, diaEMes, moeda } from "../formato";

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
 * As cores do Início: dourado sem gasto, índigo com gasto e, com cota (a de
 * hoje ou a guardada do ciclo), vermelho acima dela. A média do período fica
 * sempre; o maior dia ganha listras; os dias depois de `hoje` mostram a
 * projeção no ritmo recente.
 */
export function GraficoGastoDiario({
  gastos,
  inicio,
  fim,
  titulo,
  cota = null,
  hoje = null,
  naoUteis = [],
}: {
  gastos: GastoDiario[];
  inicio: string;
  fim: string;
  titulo: string;
  cota?: number | null;
  hoje?: string | null;
  naoUteis?: DiaNaoUtil[];
}) {
  const porDia = new Map(gastos.map((gasto) => [gasto.data, gasto]));
  const dias = diasDoIntervalo(inicio, fim);
  const total = gastos.reduce((soma, gasto) => soma + gasto.total, 0);
  const passados = dias
    .filter((dia) => hoje === null || dia <= hoje)
    .map((dia) => ({ data: dia, valor: porDia.get(dia)?.total ?? 0 }));
  const media = mediaPorDia(passados);
  const doMaior = maiorDia(passados);
  const previsto = projecao(passados, dias.length - passados.length);
  const maior = Math.max(
    ...gastos.map((gasto) => gasto.total),
    cota ?? 0,
    previsto?.ritmo ?? 0,
    0,
  );
  // 34 px: a altura do eixo (número e letra do dia) embaixo das barras.
  const naAltura = (valor: number) =>
    `calc(${(valor / maior) * ALTURA_MAXIMA}px + 34px)`;

  return (
    <section
      aria-label="Gasto por dia"
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border px-[22px] py-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">{titulo}</h2>
        <span className="num text-tinta-2 text-[13px]">
          Total no período: {moeda(total)}
        </span>
      </div>

      <div className="relative pt-5">
        {cota !== null && maior > 0 && (
          <LinhaDaCota cota={cota} style={{ bottom: naAltura(cota) }} />
        )}
        {media !== null && media > 0 && (
          <LinhaDaMedia media={media} style={{ bottom: naAltura(media) }} />
        )}
        {previsto && (
          <AreaDaProjecao
            projecao={previsto.total}
            ritmo={previsto.ritmo}
            style={{
              left: `${(passados.length / dias.length) * 100}%`,
              right: 0,
              bottom: 34,
              height: maior > 0 ? Math.max(ALTURA_VAZIA, (previsto.ritmo / maior) * ALTURA_MAXIMA) : ALTURA_VAZIA,
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
                  <span
                    aria-hidden
                    className="block w-full rounded-t-[5px]"
                    style={
                      previsto && previsto.ritmo > 0
                        ? {
                            ...BARRA_DA_PROJECAO,
                            height: (previsto.ritmo / maior) * ALTURA_MAXIMA,
                          }
                        : { height: ALTURA_VAZIA }
                    }
                  />
                ) : (
                  <ColunaComDetalhe
                    data={dia}
                    valor={valor}
                    cota={cota}
                    maiores={gasto?.maiores ?? []}
                    feriado={marcaDoDia(naoUteis, dia) ?? null}
                    maiorDoPeriodo={dia === doMaior}
                  >
                    <span
                      className={`relative block w-full rounded-t-[5px] transition-opacity group-hover:opacity-80 ${cor}`}
                      style={{
                        height: altura,
                        ...(dia === doMaior ? LISTRAS_DO_MAIOR_DIA : {}),
                      }}
                    />
                  </ColunaComDetalhe>
                )}
                <DiaDoEixo
                  data={dia}
                  hoje={hoje}
                  marca={marcaDoDia(naoUteis, dia)}
                  // No celular não cabe um número por dia: fica um a cada três, e a letra em todos.
                  escondidoNoCelular={indice % 3 !== 0}
                />
                <span className="sr-only">
                  {diaEMes(dia)}: {moeda(valor)}
                  {marcaDoDia(naoUteis, dia)
                    ? `, ${marcaDoDia(naoUteis, dia)}`
                    : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <LegendaDosDias comCota={cota !== null} />
    </section>
  );
}
