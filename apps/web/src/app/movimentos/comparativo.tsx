import { SeloDoBanco, nomeDaConta } from "../banco";
import type { FluxoDaConta } from "../buscar-movimentos";
import { moeda } from "../formato";

export function CicloContraAnterior({
  atual,
  anterior,
  numero,
}: {
  atual: number;
  anterior: number;
  numero: number;
}) {
  const variacao = anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null;
  const subiu = variacao !== null && variacao > 0;
  const maior = Math.max(atual, anterior, 1);

  return (
    <section
      aria-label="Comparativo com o ciclo anterior"
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border px-[22px] py-5"
    >
      <h2 className="text-tinta-3 text-xs font-semibold tracking-[0.06em] uppercase">
        Ciclo {numero} vs ciclo anterior
      </h2>

      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="num text-gasto text-[26px] font-semibold tracking-[-0.3px]">
          {moeda(atual)}
        </span>
        {variacao !== null && (
          <span
            className={`num rounded-full px-[7px] py-[3px] text-[11px] font-bold ${
              subiu ? "bg-gasto-fundo text-gasto" : "bg-positivo-fundo text-positivo"
            }`}
          >
            {subiu ? "+" : ""}
            {variacao}%
          </span>
        )}
      </div>
      <span className="text-tinta-3 text-xs">Ciclo anterior: {moeda(anterior)}</span>

      <div className="mt-0.5 flex flex-col gap-[7px]">
        <div className="bg-borda-sutil h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-tinta-4 h-full rounded-full"
            style={{ width: `${(anterior / maior) * 100}%` }}
          />
        </div>
        <div className="bg-borda-sutil h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-gasto-forte h-full rounded-full"
            style={{ width: `${(atual / maior) * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}

export function GastoPorConta({ fluxos }: { fluxos: FluxoDaConta[] }) {
  const comGasto = fluxos.filter((fluxo) => fluxo.saidas > 0);
  const maior = Math.max(...comGasto.map((fluxo) => fluxo.saidas), 1);

  return (
    <section
      aria-label="Gasto por conta no período"
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border px-[22px] py-5"
    >
      <h2 className="text-tinta-3 text-xs font-semibold tracking-[0.06em] uppercase">
        Gasto por conta no período
      </h2>

      {comGasto.length === 0 ? (
        <p className="text-tinta-3 text-[13px]">Nenhuma saída neste recorte.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comGasto.map((fluxo) => (
            <div key={fluxo.contaId} className="flex items-center gap-3">
              <SeloDoBanco conta={fluxo} tamanho={22} />
              <span className="w-[150px] shrink-0 truncate text-[12.5px]" title={fluxo.nome}>
                {nomeDaConta(fluxo)} · {fluxo.tipo === "CREDIT" ? "Cartão" : "Conta"}
              </span>
              <div className="bg-borda-sutil h-2 grow overflow-hidden rounded-full">
                <div
                  className="bg-gasto-forte h-full rounded-full"
                  style={{ width: `${(fluxo.saidas / maior) * 100}%` }}
                />
              </div>
              <span className="num text-tinta-2 w-[100px] text-right text-[12.5px]">
                {moeda(fluxo.saidas)}
              </span>
              {fluxo.emRevisao > 0 && (
                <span className="text-gasto text-[10.5px]">
                  {moeda(fluxo.emRevisao)} em revisão
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
