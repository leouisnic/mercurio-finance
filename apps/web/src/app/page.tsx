import { sincronizar } from "./acoes";
import { buscarCiclos, buscarFluxoPorConta } from "./buscar-movimentos";
import { buscarResumo } from "./buscar-resumo";
import { porExtenso, tempoDesde } from "./formato";
import { ResumoPainel } from "./resumo-painel";

/** Verde até 15 min, laranja até 4 h, vermelho acima: o quanto o dado da
 *  tela ainda merece confiança. */
function tomDaSincronizacao(atualizadoEm: string, agora: Date) {
  const minutos = (agora.getTime() - new Date(atualizadoEm).getTime()) / 60000;
  if (minutos <= 15) {
    return "bg-positivo-fundo text-positivo";
  }
  return minutos <= 240 ? "bg-gasto-fundo text-gasto" : "bg-alerta-fundo text-alerta";
}

export default async function VisaoGeral() {
  const agora = new Date();
  const [resumo, ciclos] = await Promise.all([buscarResumo(), buscarCiclos()]);
  const fluxos = ciclos ? await buscarFluxoPorConta(ciclos.atual.inicio, ciclos.atual.fim) : null;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <h1 className="text-[23px] font-bold tracking-[-0.2px]">Visão geral</h1>
          <span className="text-tinta-3 text-[13px] first-letter:uppercase">
            {porExtenso(agora)}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {resumo?.atualizadoEm && (
            <span
              className={`${tomDaSincronizacao(resumo.atualizadoEm, agora)} rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold`}
            >
              Sincronizado {tempoDesde(resumo.atualizadoEm, agora)}
            </span>
          )}
          <form action={sincronizar}>
            <button
              type="submit"
              className="bg-superficie border-borda text-tinta-2 hover:bg-superficie-2 cursor-pointer rounded-[10px] border px-4 py-2.5 text-[12.5px] font-semibold"
            >
              Sincronizar
            </button>
          </form>
        </div>
      </header>

      {resumo ? (
        <ResumoPainel contas={resumo.contas} fluxos={fluxos ?? []} hoje={agora} />
      ) : (
        <p
          role="alert"
          className="bg-superficie border-borda text-tinta-2 rounded-[14px] border p-5 text-sm"
        >
          Não foi possível carregar o resumo financeiro agora. Confira se o finance-api está
          rodando.
        </p>
      )}
    </>
  );
}
