import { buscarCategorias, buscarMovimentos, buscarTags } from "../../buscar-movimentos";
import { buscarResumo } from "../../buscar-resumo";
import { dataDeHoje } from "../../hoje";
import { BlocoIndisponivel, FaixaDeFalha } from "../../indisponivel";
import { AbasDeMovimentos } from "../abas";
import { Lista } from "../lista";

/** A fila do que espera categoria nos ciclos recentes, contados a partir de
 *  hoje: não depende do ciclo que se está olhando. */
export default async function ParaClassificar() {
  const [movimentos, categorias, resumo, tags] = await Promise.all([
    buscarMovimentos(undefined, undefined, undefined, 200, 0, true, dataDeHoje()),
    buscarCategorias(),
    buscarResumo(),
    buscarTags(),
  ]);
  const falhas = [
    movimentos === null && "movimentos para classificar",
    categorias === null && "categorias",
    resumo === null && "nomes das contas",
  ].filter((parte): parte is string => typeof parte === "string");

  return (
    <>
      <header className="flex flex-col gap-[3px]">
        <h1 className="text-[23px] font-bold tracking-[-0.2px]">Para classificar</h1>
        <span className="text-tinta-3 text-[13px]">
          Os dos últimos seis ciclos: Pix para quem já recebeu por coisas diferentes, e o que a
          Pluggy não soube dizer. As categorias que o destinatário já teve aparecem primeiro.
        </span>
      </header>
      <AbasDeMovimentos paraClassificar={movimentos?.length ?? null} />
      <FaixaDeFalha partes={falhas} />
      {movimentos === null ? (
        <BlocoIndisponivel titulo="Para classificar" rotulo="Movimentos" />
      ) : (
        <Lista
          movimentos={movimentos}
          contas={resumo?.contas ?? []}
          categorias={categorias}
          tagsExistentes={(tags ?? []).map((tag) => tag.nome)}
          vazio="Tudo classificado."
        />
      )}
    </>
  );
}
