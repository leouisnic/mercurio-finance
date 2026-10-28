import { Tag as IconeDeTag, X } from "lucide-react";
import Link from "next/link";
import {
  buscarCategorias,
  buscarMovimentos,
  buscarResumoDaTag,
  buscarTags,
  type Categoria,
  type Tag,
} from "../buscar-movimentos";
import { buscarResumo } from "../buscar-resumo";
import { diaEMes, moeda } from "../formato";
import { BlocoIndisponivel, FaixaDeFalha } from "../indisponivel";
import { BolaDaCategoria } from "./icones";
import { Lista } from "./lista";

/** As tags com o gasto de cada uma. Tocar numa abre o resumo dela. */
export function ListaDeTags({ tags, escolhida }: { tags: Tag[]; escolhida: number | null }) {
  if (tags.length === 0) {
    return (
      <p className="bg-superficie border-borda text-tinta-3 rounded-2xl border px-[22px] py-6 text-[13px]">
        Nenhuma tag ainda. Marque movimentos com uma tag no painel da categoria ou selecionando vários.
      </p>
    );
  }
  return (
    <nav aria-label="Tag" className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <Link
          key={tag.id}
          href={`/movimentos/tags?tag=${tag.id}`}
          aria-current={tag.id === escolhida ? "page" : undefined}
          className={
            tag.id === escolhida
              ? "bg-marca text-sobre-cor flex items-center gap-1.5 rounded-full px-3.5 py-[7px] text-[13px] font-semibold"
              : "bg-superficie border-borda text-tinta-2 hover:bg-superficie-2 flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] text-[13px]"
          }
        >
          <IconeDeTag size={13} aria-hidden="true" />
          {tag.nome}
          <b className={`num ${tag.id === escolhida ? "" : "text-gasto"}`}>{moeda(tag.gasto)}</b>
        </Link>
      ))}
    </nav>
  );
}

/** Quanto se gastou numa tag, dividido por categoria, e os movimentos dela,
 *  de qualquer data. */
export async function PorTag({ tagId }: { tagId: number }) {
  const [resumoDaTag, movimentos, categorias, tags, resumo] = await Promise.all([
    buscarResumoDaTag(tagId),
    buscarMovimentos(undefined, undefined, undefined, 500, 0, false, undefined, tagId),
    buscarCategorias(),
    buscarTags(),
    buscarResumo(),
  ]);
  const falhas = [
    resumoDaTag === null && "resumo da tag",
    movimentos === null && "movimentos da tag",
    categorias === null && "categorias",
  ].filter((parte): parte is string => typeof parte === "string");
  const porId = new Map<string, Categoria>((categorias ?? []).map((categoria) => [categoria.id, categoria]));

  return (
    <>
      <FaixaDeFalha partes={falhas} />
      {resumoDaTag === null ? (
        <BlocoIndisponivel titulo="Resumo da tag" rotulo="Resumo da tag" />
      ) : (
        <section
          aria-label={`Tag ${resumoDaTag.nome}`}
          className="bg-superficie border-borda flex flex-col gap-4 rounded-2xl border px-[22px] py-5"
        >
          <Link
            href="/movimentos/tags"
            aria-label={`Tirar o filtro da tag ${resumoDaTag.nome}`}
            className="bg-marca text-sobre-cor inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[13px] font-semibold"
          >
            <IconeDeTag size={14} aria-hidden="true" /> {resumoDaTag.nome} <X size={13} aria-hidden="true" />
          </Link>
          <span className="flex flex-col">
            <span className="num text-gasto text-[30px] font-bold tracking-[-0.3px]">{moeda(resumoDaTag.gasto)}</span>
            <span className="text-tinta-3 text-[13px]">
              em {resumoDaTag.quantidade === 1 ? "1 movimento" : `${resumoDaTag.quantidade} movimentos`}
              {resumoDaTag.primeiraData && resumoDaTag.ultimaData
                ? `, de ${diaEMes(resumoDaTag.primeiraData)} a ${diaEMes(resumoDaTag.ultimaData)}`
                : ""}
            </span>
          </span>
          <ul className="flex flex-col gap-2.5">
            {resumoDaTag.porCategoria.map(({ categoria, total }) => {
              const dados = categoria ? porId.get(categoria) : undefined;
              const parte = resumoDaTag.gasto > 0 ? (total / resumoDaTag.gasto) * 100 : 0;
              return (
                <li
                  key={categoria ?? "sem"}
                  className="grid grid-cols-[30px_minmax(0,1fr)_100px] items-center gap-2.5 text-[13px] sm:grid-cols-[30px_160px_minmax(0,1fr)_110px]"
                >
                  {dados ? <BolaDaCategoria categoria={dados} /> : <span />}
                  <span className="truncate">{dados?.nome ?? "Para classificar"}</span>
                  <span className="bg-borda-sutil h-2 overflow-hidden rounded max-sm:hidden">
                    <span className="bg-gasto-forte block h-full rounded" style={{ width: `${parte}%` }} />
                  </span>
                  <span className="num text-gasto text-right font-semibold">{moeda(total)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {movimentos === null ? (
        <BlocoIndisponivel titulo="Movimentos" rotulo="Movimentos" />
      ) : (
        <Lista
          movimentos={movimentos}
          contas={resumo?.contas ?? []}
          categorias={categorias}
          tagsExistentes={(tags ?? []).map((tag) => tag.nome)}
          vazio="Nenhum movimento com esta tag."
        />
      )}
    </>
  );
}
