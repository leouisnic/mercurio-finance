import { buscarParaClassificar, buscarTags } from "../../buscar-movimentos";
import { dataDeHoje } from "../../hoje";
import { BlocoIndisponivel } from "../../indisponivel";
import { AbasDeMovimentos } from "../abas";
import { ListaDeTags, PorTag } from "../tag";

export default async function Tags(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await props.searchParams;
  const tagId = Number(Array.isArray(parametros.tag) ? parametros.tag[0] : parametros.tag);
  const [tags, paraClassificar] = await Promise.all([buscarTags(), buscarParaClassificar(dataDeHoje())]);

  return (
    <>
      <header className="flex flex-col gap-[3px]">
        <h1 className="text-[23px] font-bold tracking-[-0.2px]">Tags</h1>
        <span className="text-tinta-3 text-[13px]">
          Quanto saiu em cada grupo que você marcou. A tag só agrupa: não muda nenhum outro número.
        </span>
      </header>
      <AbasDeMovimentos paraClassificar={paraClassificar} />
      {tags === null ? (
        <BlocoIndisponivel titulo="Suas tags" rotulo="Suas tags" />
      ) : (
        <ListaDeTags tags={tags} escolhida={Number.isInteger(tagId) ? tagId : null} />
      )}
      {Number.isInteger(tagId) && tagId > 0 && <PorTag tagId={tagId} />}
    </>
  );
}
