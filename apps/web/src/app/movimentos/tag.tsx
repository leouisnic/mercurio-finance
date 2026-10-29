import {
  CalendarDays,
  Clock,
  ReceiptText,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Categoria, ResumoDaTag, Tag } from "../buscar-movimentos";
import { comoData, mes, moeda, periodoPorExtenso } from "../formato";
import { Info } from "../info";
import {
  lerPagadores,
  nomeDoCiclo as nomeDoCicloPeloPagador,
} from "../pagadores";
import { AcoesDaTag } from "./formulario-de-tag";
import { achadosDaTag, CartaoDeAchado, CartoesDaTag } from "./leitura";
import { BolaDaCategoria, IconeDaCategoria } from "./icones";

/** "Faltam R$ 1.580,00 de R$ 9.000,00": com centavos, como todo valor em dinheiro. */
export function textoDoTeto(tag: Pick<Tag, "gasto" | "teto">): string | null {
  if (tag.teto === null) return null;
  return tag.gasto > tag.teto
    ? `Passou ${moeda(tag.gasto - tag.teto)} do teto de ${moeda(tag.teto)}`
    : `Faltam ${moeda(tag.teto - tag.gasto)} de ${moeda(tag.teto)}`;
}

function BarraDoTeto({ tag }: { tag: Pick<Tag, "gasto" | "teto" | "nome"> }) {
  if (tag.teto === null) return null;
  const parte = Math.min(100, (tag.gasto / tag.teto) * 100);
  return (
    <span
      role="meter"
      aria-label={`Teto usado da tag ${tag.nome}`}
      aria-valuenow={Math.round(parte)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="bg-borda-sutil block h-1 overflow-hidden rounded-full"
    >
      <span
        className={`block h-full rounded-full ${tag.gasto > tag.teto ? "bg-alerta-forte" : "bg-marca"}`}
        style={{ width: `${parte}%` }}
      />
    </span>
  );
}

function periodoDaTag(tag: Tag): string | null {
  return periodoPorExtenso(
    tag.inicio ?? tag.primeiraData,
    tag.fim ?? (tag.inicio ? null : tag.ultimaData),
  );
}

function DadosDaTag({ tag }: { tag: Tag }) {
  const periodo = periodoDaTag(tag);
  return (
    <span className="text-tinta flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] font-medium">
      <span className="inline-flex items-center gap-1">
        <ReceiptText size={14} aria-hidden="true" />{" "}
        {tag.quantidade === 1 ? "1 movimento" : `${tag.quantidade} movimentos`}
      </span>
      {periodo && (
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={14} aria-hidden="true" /> {periodo}
        </span>
      )}
    </span>
  );
}

/** Faixa na cor da tag no topo, valor grande, teto em frase e barra fina. */
function CartaoDaTag({ tag }: { tag: Tag }) {
  const teto = textoDoTeto(tag);
  return (
    <article
      className={`bg-superficie border-borda flex flex-col overflow-hidden rounded-2xl border transition-shadow hover:shadow-md ${tag.arquivada ? "opacity-60" : ""}`}
    >
      <div
        className="categoria-bola flex items-center gap-2 px-3.5 py-2.5"
        style={{ "--tom": tag.cor } as CSSProperties}
      >
        <IconeDaCategoria nome={tag.icone} tamanho={18} />
        <Link
          href={`/movimentos/tags/${tag.id}`}
          className="text-tinta min-w-0 flex-1 truncate text-[14px] font-bold hover:underline"
        >
          {tag.nome}
        </Link>
        {tag.arquivada && (
          <span className="border-borda text-tinta-3 rounded-full border px-2 text-[11px]">
            arquivada
          </span>
        )}
        <AcoesDaTag tag={tag} compacto />
      </div>
      <Link
        href={`/movimentos/tags/${tag.id}`}
        className="flex flex-col gap-2 px-3.5 pt-3 pb-3.5"
      >
        <span className="num text-gasto text-[22px] font-bold tracking-[-0.3px]">
          {moeda(tag.gasto)}
        </span>
        {teto && <span className="text-tinta-3 text-[12.5px]">{teto}</span>}
        <BarraDoTeto tag={tag} />
        <DadosDaTag tag={tag} />
      </Link>
    </article>
  );
}

export function ListaDeTags({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) {
    return (
      <p className="bg-superficie border-borda text-tinta-3 rounded-2xl border px-[22px] py-6 text-[13px]">
        Nenhuma tag ainda. Crie uma em &quot;Nova tag&quot; ou marque movimentos
        com uma tag.
      </p>
    );
  }
  // As arquivadas vão para o fim, apagadas.
  const ordenadas = [
    ...tags.filter((tag) => !tag.arquivada),
    ...tags.filter((tag) => tag.arquivada),
  ];
  return (
    <section
      aria-label="Suas tags"
      className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5"
    >
      {ordenadas.map((tag) => (
        <CartaoDaTag key={tag.id} tag={tag} />
      ))}
    </section>
  );
}

const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
});

type CicloComNome = { numero: number; inicio: string };
/** "Ciclo Empresa A de out": o nome de quem paga, como no Início, e o mês. */
export type NomearCiclo = (ciclo: CicloComNome) => string;

function GastoAcumulado({ resumo }: { resumo: ResumoDaTag }) {
  const pontos = resumo.acumulado;
  const topo = Math.max(resumo.teto ?? 0, pontos.at(-1)?.total ?? 0, 1) * 1.05;
  const inicio = pontos.length > 0 ? comoData(pontos[0].data).getTime() : 0;
  const duracao =
    pontos.length > 1 ? comoData(pontos.at(-1)!.data).getTime() - inicio : 1;
  const linha = pontos
    .map(
      (ponto) =>
        `${((comoData(ponto.data).getTime() - inicio) / duracao) * 100},${100 - (ponto.total / topo) * 100}`,
    )
    .join(" ");
  return (
    <section
      aria-label="Gasto acumulado"
      className="bg-superficie border-borda flex flex-col gap-2 rounded-2xl border px-4 py-3.5"
    >
      <span className="flex items-center gap-1">
        <b className="text-[14px]">Gasto acumulado</b>
        <Info
          sobre="gasto acumulado"
          texto="Soma dia a dia do que foi marcado com a tag."
        />
      </span>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-36 w-full"
        aria-hidden
      >
        {resumo.teto !== null && (
          <line
            x1="0"
            x2="100"
            y1={100 - (resumo.teto / topo) * 100}
            y2={100 - (resumo.teto / topo) * 100}
            className="stroke-alerta-forte"
            strokeDasharray="4 3"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polyline
          points={
            pontos.length === 1
              ? `0,${100 - (pontos[0].total / topo) * 100} 100,${100 - (pontos[0].total / topo) * 100}`
              : linha
          }
          fill="none"
          className="stroke-marca"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {resumo.teto !== null && (
        <span className="text-tinta-3 text-[12px]">
          A linha tracejada é o teto.
        </span>
      )}
    </section>
  );
}

function Impacto({
  impacto,
  cor,
  nomeDoCiclo,
}: {
  impacto: NonNullable<ResumoDaTag["impacto"]>;
  cor: number;
  nomeDoCiclo: NomearCiclo;
}) {
  const topo =
    Math.max(
      ...impacto.barras.map((barra) => barra.gastoSemATag + barra.gastoDaTag),
      impacto.tipico,
      1,
    ) * 1.1;
  return (
    <section
      aria-label="Impacto no orçamento"
      className="bg-superficie border-borda flex flex-col gap-3 rounded-2xl border px-4 py-3.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-1">
          <b className="text-[14px]">Impacto no orçamento</b>
          <Info
            sobre="o impacto"
            texto="Típico é a média dos 3 ciclos anteriores. O rombo da tag é quanto ela pesou no que o ciclo passou do típico."
          />
        </span>
      </div>
      <div className="grid gap-5 md:grid-cols-[230px_1fr] md:items-center">
        <div className="flex flex-col gap-3.5">
          <span className="flex flex-col">
            <span className="text-tinta inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
              <TrendingUp size={15} aria-hidden="true" /> Rombo da tag
            </span>
            <span
              className={`num text-[22px] font-bold ${impacto.romboDaTag > 0 ? "text-alerta" : "text-positivo"}`}
            >
              {impacto.romboDaTag > 0 ? moeda(impacto.romboDaTag) : "Nenhum"}
            </span>
            {impacto.rombo > impacto.romboDaTag && (
              <span className="text-tinta-3 text-[12px]">
                de {moeda(impacto.rombo)} no ciclo
              </span>
            )}
          </span>
          {impacto.romboDaTag > 0 && (
            <span className="flex flex-col">
              <span className="text-tinta inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
                <Clock size={14} aria-hidden="true" /> Recupera em
              </span>
              <span className="text-tinta text-[22px] font-bold">
                {impacto.ciclosParaRecuperar === null
                  ? "sem previsão"
                  : impacto.ciclosParaRecuperar === 1
                    ? "1 ciclo"
                    : `${impacto.ciclosParaRecuperar} ciclos`}
              </span>
              {impacto.ciclosParaRecuperar !== null && (
                <span className="text-tinta-3 text-[12px]">
                  guardando {moeda(impacto.sobraMedia)} por ciclo
                </span>
              )}
            </span>
          )}
        </div>
        <div className="relative h-44" aria-hidden>
          <div
            className="border-marca pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed"
            style={{
              bottom: `calc(${(impacto.tipico / topo) * 100}% * 0.86 + 22px)`,
            }}
          >
            <span className="text-marca absolute -top-[18px] right-0 text-[11px] font-bold">
              típico {moeda(impacto.tipico)}
            </span>
          </div>
          <div
            className="grid h-full items-end gap-3"
            style={{
              gridTemplateColumns: `repeat(${impacto.barras.length}, minmax(0, 1fr))`,
            }}
          >
            {impacto.barras.map((barra) => (
              <div
                key={barra.ciclo.inicio}
                className="flex h-full flex-col items-center justify-end gap-1"
              >
                <div
                  className="flex w-3/5 flex-col overflow-hidden rounded-t"
                  style={{
                    height: `${((barra.gastoSemATag + barra.gastoDaTag) / topo) * 86}%`,
                  }}
                >
                  {barra.gastoDaTag > 0 && (
                    <span
                      className="categoria-bola block"
                      style={
                        {
                          flex: barra.gastoDaTag,
                          "--tom": cor,
                          background: `oklch(var(--categoria-icone) ${cor})`,
                        } as CSSProperties
                      }
                    />
                  )}
                  <span
                    className="bg-tinta-4 block"
                    style={{ flex: Math.max(barra.gastoSemATag, 0) }}
                  />
                </div>
                <span className="text-tinta flex max-w-full flex-col items-center text-center text-[12px] leading-tight font-semibold">
                  <span className="max-w-full truncate">
                    {nomeDoCiclo(barra.ciclo)
                      .split(" de ")[0]
                      .replace("Ciclo ", "")}
                  </span>
                  <span className="text-tinta-3">
                    {mes(barra.ciclo.inicio)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        className="text-tinta-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]"
        aria-hidden
      >
        <span className="inline-flex items-center gap-1.5">
          <i className="bg-tinta-4 inline-block size-[11px] rounded-[3px]" />{" "}
          Gasto sem a tag
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i
            className="inline-block size-[11px] rounded-[3px]"
            style={{ background: `oklch(var(--categoria-icone) ${cor})` }}
          />{" "}
          Gasto da tag
        </span>
      </div>
      {/* Tabela com sr-only ignora a largura e alarga a página no celular. */}
      <div className="sr-only">
        <table>
          <caption>Gasto de cada ciclo, com a parte da tag</caption>
          <tbody>
            {impacto.barras.map((barra) => (
              <tr key={barra.ciclo.inicio}>
                <th scope="row">{nomeDoCiclo(barra.ciclo)}</th>
                <td>
                  {moeda(barra.gastoSemATag + barra.gastoDaTag)}, da tag{" "}
                  {moeda(barra.gastoDaTag)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A tag aberta: números, leitura, impacto, acumulado, categorias e maiores gastos. */
export function TagAberta({
  resumo,
  categorias,
  hoje,
}: {
  resumo: ResumoDaTag;
  categorias: Categoria[];
  hoje: string;
}) {
  const porId = new Map(
    categorias.map((categoria) => [categoria.id, categoria]),
  );
  const teto = textoDoTeto(resumo);
  const maiorCategoria = Math.max(
    ...resumo.porCategoria.map((item) => item.total),
    1,
  );
  const achados = achadosDaTag(resumo, (id) => porId.get(id), hoje);
  const pagadores = lerPagadores();
  const nomeDoCiclo: NomearCiclo = (ciclo) =>
    `${nomeDoCicloPeloPagador(ciclo.numero, pagadores)} de ${mes(ciclo.inicio)}`;

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-wrap items-center gap-3">
        <BolaDaCategoria categoria={resumo} tamanho={44} />
        <span className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
          <h1 className="truncate text-[23px] font-bold tracking-[-0.2px]">
            {resumo.nome}
          </h1>
          <DadosDaTag tag={resumo} />
        </span>
        <AcoesDaTag tag={resumo} depoisDeApagar="/movimentos/tags" />
      </header>

      <CartoesDaTag resumo={resumo} textoDoTeto={teto} />

      {achados.length > 0 && (
        <section
          aria-label="Leitura"
          className="bg-superficie border-borda flex flex-col gap-3 rounded-2xl border p-4"
        >
          <span className="flex items-center gap-1">
            <b className="inline-flex items-center gap-1.5 text-[14px]">
              <Sparkles size={15} aria-hidden="true" /> Leitura
            </b>
            <Info
              sobre="a leitura"
              texto="Só o que não aparece no resto da página, calculado dos movimentos da tag. Achado que não se aplica não aparece."
            />
          </span>
          <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
            {achados.map(({ id, ...achado }) => (
              <CartaoDeAchado key={id} {...achado} />
            ))}
          </div>
        </section>
      )}

      {resumo.impacto && (
        <Impacto
          impacto={resumo.impacto}
          cor={resumo.cor}
          nomeDoCiclo={nomeDoCiclo}
        />
      )}

      <div className="grid gap-3.5 md:grid-cols-2">
        {resumo.acumulado.length > 0 && <GastoAcumulado resumo={resumo} />}
        <section
          aria-label="Por categoria"
          className="bg-superficie border-borda flex flex-col gap-2.5 rounded-2xl border px-4 py-3.5"
        >
          <b className="text-[14px]">Por categoria</b>
          <ul className="flex flex-col gap-2.5">
            {resumo.porCategoria.map(({ categoria, total }) => {
              const dados = categoria ? porId.get(categoria) : undefined;
              return (
                <li
                  key={categoria ?? "sem"}
                  className="grid grid-cols-[28px_minmax(0,1fr)_90px] items-center gap-2.5 text-[13px] sm:grid-cols-[28px_130px_minmax(0,1fr)_90px]"
                >
                  {dados ? (
                    <BolaDaCategoria categoria={dados} tamanho={28} />
                  ) : (
                    <span />
                  )}
                  <span className="truncate">
                    {dados?.nome ?? "Para classificar"}
                  </span>
                  <span className="bg-borda-sutil h-2 overflow-hidden rounded max-sm:hidden">
                    <span
                      className="bg-marca block h-full rounded"
                      style={{ width: `${(total / maiorCategoria) * 100}%` }}
                    />
                  </span>
                  <span className="num text-gasto text-right font-semibold">
                    {moeda(total)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {resumo.maiores.length > 0 && (
        <section
          aria-label="Maiores gastos"
          className="bg-superficie border-borda flex flex-col gap-1.5 rounded-2xl border px-4 py-3.5"
        >
          <b className="text-[14px]">Maiores gastos</b>
          {resumo.maiores.map((item, indice) => (
            <div
              key={`${item.descricao}-${indice}`}
              className="flex justify-between gap-3 text-[13px]"
            >
              <span className="text-tinta-2 truncate">
                {item.descricao}
                <span className="text-tinta-3">
                  {" "}
                  · {DIA_LONGO.format(comoData(item.data))}
                </span>
              </span>
              <b className="num text-gasto shrink-0">{moeda(item.valor)}</b>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
