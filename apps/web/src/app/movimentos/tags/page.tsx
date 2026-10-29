import { redirect } from "next/navigation";
import { buscarParaClassificar, buscarTags } from "../../buscar-movimentos";
import { dataDeHoje } from "../../hoje";
import { BlocoIndisponivel } from "../../indisponivel";
import { AbasDeMovimentos } from "../abas";
import { BotaoNovaTag } from "../formulario-de-tag";
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

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col gap-[3px]">
          <h1 className="text-[23px] font-bold tracking-[-0.2px]">Tags</h1>
          <span className="text-tinta-3 text-[13px]">
            Quanto saiu em cada grupo que você marcou.
          </span>
        </span>
        <BotaoNovaTag />
      </header>
      <AbasDeMovimentos paraClassificar={paraClassificar} />
      {tags === null ? (
        <BlocoIndisponivel titulo="Suas tags" rotulo="Suas tags" />
      ) : (
        <ListaDeTags tags={tags} />
      )}
    </>
  );
}
