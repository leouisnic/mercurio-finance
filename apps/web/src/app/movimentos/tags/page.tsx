import { redirect } from "next/navigation";
import { buscarParaClassificar, buscarTags } from "../../buscar-movimentos";
import { dataDeHoje } from "../../hoje";
import { BlocoIndisponivel } from "../../indisponivel";
import { AbasDeMovimentos } from "../abas";
import { BotaoNovaTag } from "../formulario-de-tag";
import { anosDasTags, filtrarTags, lerFiltroDeTags } from "../filtro-de-tags";
import { FiltrosDeTags } from "../filtros-de-tags";
import { ListaDeTags } from "../tag";

export default async function Tags(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await props.searchParams;
  // O endereço antigo de uma tag continua funcionando.
  const antiga = Array.isArray(parametros.tag)
    ? parametros.tag[0]
    : parametros.tag;
  if (antiga) {
    redirect(`/movimentos/tags/${antiga}`);
  }
  const [tags, paraClassificar] = await Promise.all([
    buscarTags(),
    buscarParaClassificar(dataDeHoje()),
  ]);
  const filtro = lerFiltroDeTags(parametros);
  const filtradas = tags ? filtrarTags(tags, filtro, dataDeHoje()) : [];

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col gap-[3px]">
          <h1 className="text-[23px] font-bold tracking-[-0.2px]">Tags</h1>
          <span className="text-tinta-3 text-[13px]">
            Quanto saiu em cada grupo que você marcou.
          </span>
        </span>
        <BotaoNovaTag hoje={dataDeHoje()} />
      </header>
      <AbasDeMovimentos paraClassificar={paraClassificar} />
      {tags === null ? (
        <BlocoIndisponivel titulo="Suas tags" rotulo="Suas tags" />
      ) : (
        <>
          <FiltrosDeTags filtro={filtro} anos={anosDasTags(tags)} />
          {tags.length > 0 && filtradas.length === 0 ? (
            <p className="bg-superficie border-borda text-tinta-3 rounded-2xl border px-[22px] py-6 text-[13px]">
              Nenhuma tag com esses filtros.
            </p>
          ) : (
            <ListaDeTags tags={filtradas} />
          )}
        </>
      )}
    </>
  );
}
