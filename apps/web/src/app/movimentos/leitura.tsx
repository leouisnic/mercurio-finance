import {
  CalendarRange,
  Crown,
  Flame,
  Gauge,
  Leaf,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { ResumoDaTag } from "../buscar-movimentos";
import { comoData, moeda } from "../formato";
import { IconeDaCategoria } from "./icones";

/**
 * Os cartões da tag aberta: os três de cima (gasto, ritmo, maior gasto) e a
 * leitura, só com o que não aparece em outro lugar da página. Cada achado é
 * calculado dos movimentos da tag e só aparece quando se aplica.
 */

const DIA = 24 * 60 * 60 * 1000;
const DIA_E_MES = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
});

/** O gasto de cada dia do período da tag, inclusive os dias sem gasto, a
 *  partir do acumulado que a API manda. */
export function gastoPorDia(
  resumo: ResumoDaTag,
): { data: string; total: number }[] {
  const { acumulado } = resumo;
  if (acumulado.length === 0) return [];
  const porData = new Map<string, number>();
  acumulado.forEach((ponto, indice) => {
    porData.set(
      ponto.data,
      ponto.total - (indice > 0 ? acumulado[indice - 1].total : 0),
    );
  });
  const dias: { data: string; total: number }[] = [];
  const fim = comoData(acumulado.at(-1)!.data);
  for (
    let dia = comoData(acumulado[0].data);
    dia <= fim;
    dia = new Date(dia.getTime() + DIA)
  ) {
    const iso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;
    dias.push({ data: iso, total: porData.get(iso) ?? 0 });
  }
  return dias;
}

export type Achado = {
  id: string;
  icone: ReactNode;
  cor: number;
  titulo: string;
  valor: string;
  positivo?: boolean;
  visual: ReactNode;
  apoio: string;
};

const porcento = (parte: number, total: number) =>
  Math.round((parte / total) * 100);

/** Os achados que se aplicam a esta tag, na ordem em que aparecem. */
export function achadosDaTag(
  resumo: ResumoDaTag,
  categoriaDe: (
    id: string,
  ) => { nome: string; icone: string; cor: number } | undefined,
  hoje: string,
): Achado[] {
  const dias = gastoPorDia(resumo);
  if (resumo.gasto <= 0 || dias.length === 0) return [];
  const achados: Achado[] = [];
  const maiorDia = Math.max(...dias.map((dia) => dia.total), 1);

  const principal = resumo.categoriaPrincipal;
  if (
    principal &&
    principal.tipicoPorCiclo &&
    principal.total >= principal.tipicoPorCiclo * 1.2
  ) {
    const vezes = principal.total / principal.tipicoPorCiclo;
    const categoria = categoriaDe(principal.categoria);
    achados.push({
      id: "categoria",
      icone: (
        <IconeDaCategoria nome={categoria?.icone ?? "Ellipsis"} tamanho={17} />
      ),
      cor: categoria?.cor ?? 278,
      titulo: `${categoria?.nome ?? principal.categoria} acima do normal`,
      valor: `${vezes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×`,
      visual: (
        <span className="flex w-full flex-col gap-1.5">
          <span
            className="bg-gasto-forte block h-2 rounded-full"
            style={{ width: "100%" }}
          />
          <span
            className="bg-tinta-4 block h-2 rounded-full"
            style={{ width: `${Math.max((1 / vezes) * 100, 4)}%` }}
          />
        </span>
      ),
      apoio: `${moeda(principal.total)} contra ${moeda(principal.tipicoPorCiclo)} por ciclo`,
    });
  }

  if (dias.length >= 5) {
    const tres = [...dias].sort((a, b) => b.total - a.total).slice(0, 3);
    const parte = porcento(
      tres.reduce((soma, dia) => soma + dia.total, 0),
      resumo.gasto,
    );
    if (parte >= 40) {
      const picos = new Set(tres.map((dia) => dia.data));
      achados.push({
        id: "concentrado",
        icone: <Flame size={17} aria-hidden="true" />,
        cor: 27,
        titulo: "Gasto concentrado",
        valor: `3 dias = ${parte}%`,
        visual: (
          <Barrinhas
            dias={dias}
            maior={maiorDia}
            destaque={(dia) => picos.has(dia.data)}
          />
        ),
        apoio: `de ${dias.length} dias de gasto`,
      });
    }
  }

  if (dias.length >= 3) {
    const fds = dias
      .filter((dia) => [0, 5, 6].includes(comoData(dia.data).getDay()))
      .reduce((soma, dia) => soma + dia.total, 0);
    const parte = porcento(fds, resumo.gasto);
    const porSemana = [1, 2, 3, 4, 5, 6, 0].map((semana) =>
      dias
        .filter((dia) => comoData(dia.data).getDay() === semana)
        .reduce((soma, dia) => soma + dia.total, 0),
    );
    const maiorSemana = Math.max(...porSemana, 1);
    achados.push({
      id: "semana",
      icone: <CalendarRange size={17} aria-hidden="true" />,
      cor: 290,
      titulo: parte >= 50 ? "Fim de semana pesou" : "Dias úteis pesaram",
      valor: `${parte >= 50 ? parte : 100 - parte}%`,
      visual: (
        <span className="flex h-full w-full items-end gap-1">
          {porSemana.map((total, indice) => (
            <span
              key={indice}
              className="flex h-full flex-1 flex-col items-center justify-end gap-0.5"
            >
              <span
                className={`block w-full rounded-t-sm ${indice >= 4 ? "bg-marca" : "bg-tinta-4"}`}
                style={{
                  height: `${Math.max((total / maiorSemana) * 100, 4)}%`,
                }}
              />
              <span className="text-tinta-3 text-[9.5px] leading-none">
                {"STQQSSD"[indice]}
              </span>
            </span>
          ))}
        </span>
      ),
      apoio: parte >= 50 ? "de sexta a domingo" : "de segunda a quinta",
    });
  }

  if (dias.length >= 4) {
    const meio = Math.floor(dias.length / 2);
    const media = (lista: typeof dias) =>
      lista.reduce((soma, dia) => soma + dia.total, 0) / lista.length;
    const antes = media(dias.slice(0, meio));
    const depois = media(dias.slice(meio));
    if (antes > 0) {
      const variacao = Math.round(((depois - antes) / antes) * 100);
      const maior = Math.max(antes, depois);
      achados.push({
        id: "ritmo",
        icone:
          variacao <= 0 ? (
            <TrendingDown size={17} aria-hidden="true" />
          ) : (
            <TrendingUp size={17} aria-hidden="true" />
          ),
        cor: variacao <= 0 ? 150 : 27,
        titulo: variacao <= 0 ? "Ritmo caiu" : "Ritmo subiu",
        valor: `${variacao > 0 ? "+" : ""}${variacao}%`,
        positivo: variacao <= 0,
        visual: (
          <span className="flex h-full w-full items-end gap-3">
            <span
              className="bg-tinta-4 block flex-1 rounded-t-sm"
              style={{ height: `${(antes / maior) * 100}%` }}
            />
            <span
              className={`block flex-1 rounded-t-sm ${variacao <= 0 ? "bg-positivo-forte" : "bg-alerta-forte"}`}
              style={{ height: `${Math.max((depois / maior) * 100, 4)}%` }}
            />
          </span>
        ),
        apoio: `${moeda(antes)}/dia, depois ${moeda(depois)}/dia`,
      });
    }
  }

  // Previsão só com teto e período ainda em andamento.
  if (
    resumo.teto !== null &&
    resumo.fim &&
    hoje <= resumo.fim &&
    resumo.acumulado.length > 0
  ) {
    const ultimos = dias.slice(-3);
    const ritmo =
      ultimos.reduce((soma, dia) => soma + dia.total, 0) / ultimos.length;
    const restantes = Math.max(
      Math.round(
        (comoData(resumo.fim).getTime() - comoData(hoje).getTime()) / DIA,
      ),
      0,
    );
    const previsao = resumo.gasto + ritmo * restantes;
    const dentro = previsao <= resumo.teto;
    achados.push({
      id: "previsao",
      icone: <Target size={17} aria-hidden="true" />,
      cor: 160,
      titulo: "Previsão para o teto",
      valor: moeda(previsao),
      positivo: dentro,
      visual: (
        <span className="bg-borda-sutil flex h-2 w-full self-center overflow-hidden rounded-full">
          <span
            className="bg-marca block h-full"
            style={{
              width: `${Math.min((resumo.gasto / resumo.teto) * 100, 100)}%`,
            }}
          />
          <span
            className="block h-full"
            style={{
              width: `${Math.min(((previsao - resumo.gasto) / resumo.teto) * 100, 100)}%`,
              background:
                "repeating-linear-gradient(135deg, var(--color-marca) 0 3px, transparent 3px 6px)",
            }}
          />
        </span>
      ),
      apoio: dentro
        ? `${moeda(resumo.teto - previsao)} abaixo do teto`
        : `${moeda(previsao - resumo.teto)} acima do teto`,
    });
  }

  if (dias.length >= 3) {
    const zerados = dias.filter((dia) => dia.total === 0);
    achados.push({
      id: "sem-gasto",
      icone: <Leaf size={17} aria-hidden="true" />,
      cor: 140,
      titulo: "Dias sem gasto",
      valor: `${zerados.length} de ${dias.length}`,
      positivo: zerados.length > 0,
      visual: (
        <span className="flex w-full flex-wrap content-center gap-1">
          {dias.map((dia) => (
            <span
              key={dia.data}
              title={DIA_E_MES.format(comoData(dia.data))}
              className={`block rounded-full ${dias.length > 21 ? "size-2" : "size-3"} ${dia.total === 0 ? "bg-caixinha" : "bg-borda"}`}
            />
          ))}
        </span>
      ),
      apoio:
        zerados.length === 0
          ? "gastou todos os dias"
          : `${DIA_E_MES.format(comoData(zerados[0].data))} sem gasto`,
    });
  }
  return achados;
}

function Barrinhas({
  dias,
  maior,
  destaque,
}: {
  dias: { data: string; total: number }[];
  maior: number;
  destaque: (dia: { data: string; total: number }) => boolean;
}) {
  return (
    <span className="flex h-full w-full items-end gap-[2px]">
      {dias.map((dia) => (
        <span
          key={dia.data}
          className={`block flex-1 rounded-t-sm ${destaque(dia) ? "bg-alerta-forte" : "bg-tinta-4"}`}
          style={{ height: `${Math.max((dia.total / maior) * 100, 4)}%` }}
        />
      ))}
    </span>
  );
}

/**
 * Um cartão do mesmo tamanho que os outros: ícone e título em cima; embaixo,
 * o número grande com a linha de apoio à esquerda e o desenho ao lado, para
 * nenhum dos dois ficar sozinho numa linha.
 */
export function CartaoDeAchado({
  icone,
  cor,
  titulo,
  valor,
  positivo,
  visual,
  apoio,
  destaque = false,
}: Omit<Achado, "id"> & { destaque?: boolean }) {
  return (
    <article
      className={`border-borda flex min-w-0 flex-col gap-3 rounded-2xl border p-4 ${destaque ? "bg-superficie" : "bg-superficie-2"}`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="categoria-bola grid size-8 shrink-0 place-items-center rounded-full"
          style={{ "--tom": cor } as CSSProperties}
        >
          {icone}
        </span>
        <b className="text-tinta truncate text-[13.5px]" title={titulo}>
          {titulo}
        </b>
      </span>
      <span className="flex min-w-0 items-end justify-between gap-4">
        <span className="flex min-w-0 flex-col gap-1">
          <span
            className={`num truncate text-[26px] leading-none font-bold tracking-[-0.4px] ${positivo ? "text-positivo" : destaque ? "text-gasto" : "text-tinta"}`}
          >
            {valor}
          </span>
          <span className="text-tinta-2 truncate text-[12.5px]" title={apoio}>
            {apoio}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="flex h-12 w-28 shrink-0 items-end justify-end sm:w-36"
        >
          {visual}
        </span>
      </span>
    </article>
  );
}

/** Os três cartões de cima, no mesmo padrão dos achados. */
export function CartoesDaTag({
  resumo,
  textoDoTeto,
}: {
  resumo: ResumoDaTag;
  textoDoTeto: string | null;
}) {
  const dias = gastoPorDia(resumo);
  const maiorDia = Math.max(...dias.map((dia) => dia.total), 1);
  const [maior] = resumo.maiores;
  const parteDoMaior =
    maior && resumo.gasto > 0 ? porcento(maior.valor, resumo.gasto) : 0;
  const pontos = dias
    .map(
      (dia, indice) =>
        `${dias.length > 1 ? (indice / (dias.length - 1)) * 100 : 50},${100 - (dia.total / maiorDia) * 90}`,
    )
    .join(" ");

  return (
    <div className="grid auto-rows-fr gap-3.5 md:grid-cols-3">
      <CartaoDeAchado
        destaque
        icone={<Wallet size={17} aria-hidden="true" />}
        cor={278}
        titulo="Gasto"
        valor={moeda(resumo.gasto)}
        visual={
          resumo.teto !== null ? (
            <span className="bg-borda-sutil block h-2 w-full self-center overflow-hidden rounded-full">
              <span
                className={`block h-full rounded-full ${resumo.gasto > resumo.teto ? "bg-alerta-forte" : "bg-marca"}`}
                style={{
                  width: `${Math.min((resumo.gasto / resumo.teto) * 100, 100)}%`,
                }}
              />
            </span>
          ) : dias.length >= 3 ? (
            <Barrinhas dias={dias} maior={maiorDia} destaque={() => false} />
          ) : null
        }
        apoio={
          textoDoTeto ??
          `${resumo.quantidade === 1 ? "1 movimento" : `${resumo.quantidade} movimentos`}`
        }
      />
      <CartaoDeAchado
        destaque
        icone={<Gauge size={17} aria-hidden="true" />}
        cor={200}
        titulo="Ritmo"
        valor={`${moeda(resumo.porDia)}/dia`}
        visual={
          // Com menos de três dias a linha não mostra tendência nenhuma.
          dias.length >= 3 && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <polyline
                points={pontos}
                fill="none"
                className="stroke-marca"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )
        }
        apoio={resumo.dias === 1 ? "em 1 dia" : `em ${resumo.dias} dias`}
      />
      <CartaoDeAchado
        destaque
        icone={<Crown size={17} aria-hidden="true" />}
        cor={75}
        titulo="Maior gasto"
        valor={maior ? moeda(maior.valor) : moeda(0)}
        visual={
          <span
            className="block size-10 rounded-full"
            style={{
              background: `conic-gradient(var(--color-gasto-forte) ${parteDoMaior}%, var(--color-borda-sutil) 0)`,
            }}
          />
        }
        apoio={
          maior
            ? `${maior.descricao}, ${parteDoMaior}% do total`
            : "sem gasto ainda"
        }
      />
    </div>
  );
}
