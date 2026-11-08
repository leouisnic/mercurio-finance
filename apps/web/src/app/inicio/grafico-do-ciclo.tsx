import { ChartColumn } from "lucide-react";
import { type DiaNaoUtil, marcaDoDia } from "../buscar-feriados";
import type { GastoDoDetalhe } from "../buscar-movimentos";
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
import { Info } from "../info";

type Dia = {
  data: string;
  valor: number;
  futuro: boolean;
  maiores: GastoDoDetalhe[];
};

/** A cor diz o tipo do dia, e o valor escrito e a legenda dizem o mesmo: cor
 *  nunca é o único sinal. */
function corDoDia(valor: number, cota: number | null): string {
  if (valor === 0) return "bg-caixinha";
  return cota !== null && valor > cota ? "bg-alerta-forte" : "bg-marca";
}

function diasDoCiclo(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  const ultimo = comoData(fim);
  const doisDigitos = (valor: number) => String(valor).padStart(2, "0");
  for (
    let dia = comoData(inicio);
    dia <= ultimo;
    dia.setDate(dia.getDate() + 1)
  ) {
    dias.push(
      `${dia.getFullYear()}-${doisDigitos(dia.getMonth() + 1)}-${doisDigitos(dia.getDate())}`,
    );
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

const CORTE =
  "repeating-linear-gradient(135deg, var(--color-superficie) 0 3px, transparent 3px 6px)";

/**
 * Gasto de cada dia contra a cota: dourado sem gasto, índigo dentro da cota,
 * vermelho acima. Os dias que ainda não chegaram ficam vazios, para o eixo
 * mostrar o período inteiro. Sem cota (outro período ou com filtro), não há
 * linha nem vermelho.
 */
export function GraficoDoCiclo({
  inicio,
  fim,
  hoje,
  cota,
  gastos,
  naoUteis = [],
}: {
  inicio: string;
  fim: string;
  hoje: string;
  cota: number | null;
  gastos: { data: string; total: number; maiores?: GastoDoDetalhe[] }[];
  naoUteis?: DiaNaoUtil[];
}) {
  const porDia = new Map(gastos.map((gasto) => [gasto.data, gasto]));
  const cotaVisivel = cota === null ? null : Math.max(cota, 0);
  const dados: Dia[] = diasDoCiclo(inicio, fim).map((data) => {
    const futuro = data > hoje;
    return {
      data,
      valor: futuro ? 0 : (porDia.get(data)?.total ?? 0),
      futuro,
      maiores: porDia.get(data)?.maiores ?? [],
    };
  });
  const passados = dados.filter((dia) => !dia.futuro);
  const teto = tetoDaEscala(
    passados.map((dia) => dia.valor),
    cotaVisivel ?? 0,
  );
  const algumCortado = passados.some((dia) => dia.valor > teto);
  const media = mediaPorDia(passados);
  const doMaior = maiorDia(passados);
  const futuros = dados.length - passados.length;
  const previsto = projecao(passados, futuros);

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
          texto={
            cotaVisivel === null
              ? "Sem contas fixas e fatura."
              : "Sem contas fixas e fatura. Passe o mouse ou toque num dia para ver o detalhe, e na área tracejada para ver a projeção."
          }
        />
      </div>

      <div className="relative pt-[26px]">
        <div
          className="relative grid h-[170px] gap-1"
          style={{
            gridTemplateColumns: `repeat(${dados.length}, minmax(0, 1fr))`,
          }}
        >
          {cotaVisivel !== null && (
            <LinhaDaCota
              cota={cotaVisivel}
              style={{ bottom: `${(cotaVisivel / teto) * 100}%` }}
            />
          )}
          {media !== null && media > 0 && (
            <LinhaDaMedia
              media={media}
              style={{ bottom: `${(Math.min(media, teto) / teto) * 100}%` }}
            />
          )}
          {previsto && (
            <AreaDaProjecao
              projecao={previsto.total}
              ritmo={previsto.ritmo}
              style={{
                left: `${(passados.length / dados.length) * 100}%`,
                right: 0,
                bottom: 0,
                height: `${Math.max(3, (Math.min(previsto.ritmo, teto) / teto) * 100)}%`,
              }}
            />
          )}
          {dados.map((dia) => {
            if (dia.futuro) {
              return (
                <div
                  key={dia.data}
                  className="border-borda flex items-end justify-center border-b"
                >
                  {previsto && previsto.ritmo > 0 && (
                    <span
                      aria-hidden
                      className="block w-[70%] max-w-[30px] rounded-t"
                      style={{
                        ...BARRA_DA_PROJECAO,
                        height: `${(Math.min(previsto.ritmo, teto) / teto) * 100}%`,
                      }}
                    />
                  )}
                </div>
              );
            }
            const cortado = dia.valor > teto;
            const altura = (Math.min(dia.valor, teto) / teto) * 100;
            return (
              <div
                key={dia.data}
                className="border-borda flex items-end justify-center border-b"
              >
                <ColunaComDetalhe
                  data={dia.data}
                  valor={dia.valor}
                  cota={cotaVisivel}
                  maiores={dia.maiores}
                  feriado={marcaDoDia(naoUteis, dia.data) ?? null}
                  maiorDoPeriodo={dia.data === doMaior}
                >
                  <span
                    className={`relative block w-[70%] max-w-[30px] rounded-t transition-opacity group-hover:opacity-80 ${corDoDia(dia.valor, cotaVisivel)}`}
                    style={{
                      height: `${Math.max(altura, 3)}%`,
                      ...(dia.data === doMaior ? LISTRAS_DO_MAIOR_DIA : {}),
                    }}
                  >
                    {cortado && (
                      <span
                        className="absolute inset-x-[-3px] top-3.5 h-2"
                        style={{ background: CORTE }}
                      />
                    )}
                  </span>
                </ColunaComDetalhe>
              </div>
            );
          })}
        </div>
        <div
          className="mt-1.5 grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${dados.length}, minmax(0, 1fr))`,
          }}
        >
          {dados.map((dia, indice) => (
            <DiaDoEixo
              key={dia.data}
              data={dia.data}
              hoje={hoje}
              marca={marcaDoDia(naoUteis, dia.data)}
              // No celular não cabe um número por dia: fica um a cada três, e a letra em todos.
              escondidoNoCelular={indice % 3 !== 0}
            />
          ))}
        </div>
      </div>

      <LegendaDosDias
        comCota={cotaVisivel !== null}
        foraDaEscala={algumCortado}
      />

      {/* Tabela com sr-only ignora a largura e alarga a página no celular. */}
      <div className="sr-only">
        <table>
          <caption>
            Gasto por dia
            {cotaVisivel !== null ? `, cota de ${moeda(cotaVisivel)}` : ""}
          </caption>
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
                  {cotaVisivel !== null && dia.valor > cotaVisivel
                    ? ", acima da cota"
                    : ""}
                  {marcaDoDia(naoUteis, dia.data)
                    ? `, ${marcaDoDia(naoUteis, dia.data)}`
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
