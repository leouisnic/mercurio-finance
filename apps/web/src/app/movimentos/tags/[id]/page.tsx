import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buscarCategorias,
  buscarMovimentos,
  buscarResumoDaTag,
  buscarTags,
} from "../../../buscar-movimentos";
import { buscarResumo } from "../../../buscar-resumo";
import { dataDeHoje } from "../../../hoje";
import { BlocoIndisponivel, FaixaDeFalha } from "../../../indisponivel";
import { Lista } from "../../lista";
import { TagAberta } from "../../tag";

export default async function TagAbertaPagina(props: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await props.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }
  const [resumo, movimentos, categorias, tags, contas] = await Promise.all([
    buscarResumoDaTag(id, dataDeHoje()),
    buscarMovimentos(
      undefined,
      undefined,
      undefined,
      500,
      0,
      false,
      undefined,
      id,
    ),
    buscarCategorias(),
    buscarTags(),
    buscarResumo(),
  ]);
  const falhas = [
    resumo === null && "resumo da tag",
    movimentos === null && "movimentos da tag",
    categorias === null && "categorias",
  ].filter((parte): parte is string => typeof parte === "string");

  return (
    <>
      <Link
        href="/movimentos/tags"
        className="text-marca inline-flex items-center gap-1.5 self-start rounded-lg px-1.5 py-1 text-[13px] font-semibold hover:bg-marca-clara"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Tags
      </Link>
      <FaixaDeFalha partes={falhas} />
      {resumo === null ? (
        <BlocoIndisponivel titulo="Tag" rotulo="Tag" />
      ) : (
        <TagAberta
          resumo={resumo}
          categorias={categorias ?? []}
          hoje={dataDeHoje()}
        />
      )}
      {movimentos !== null && (
        <Lista
          movimentos={movimentos}
          contas={contas?.contas ?? []}
          categorias={categorias}
          tagsExistentes={(tags ?? []).map((tag) => tag.nome)}
          tags={tags ?? []}
          vazio="Nenhum movimento com esta tag."
        />
      )}
    </>
  );
}
