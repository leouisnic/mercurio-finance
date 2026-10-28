import { CalendarDays, PiggyBank, Wallet } from "lucide-react";
import type { DinheiroLivre } from "../buscar-dinheiro-livre";
import { moeda } from "../formato";
import { Info } from "../info";

function comSinal(valor: number): string {
  return valor < 0 ? `- ${moeda(-valor)}` : `+ ${moeda(valor)}`;
}

/** O número que a tela inicial responde primeiro: quanto dá para gastar hoje. */
export function HojeDaParaGastar({ dinheiro }: { dinheiro: DinheiroLivre }) {
  const { hojeDisponivel, gastoHoje, cotaDoDia, cofrinho } = dinheiro;
  const podiaHoje = gastoHoje + hojeDisponivel;
  const usado = podiaHoje > 0 ? Math.min(100, (gastoHoje / podiaHoje) * 100) : 100;
  const estourou = hojeDisponivel < 0;

  return (
    <section
      aria-label="Hoje dá para gastar"
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border p-4"
    >
      <div className="flex items-center gap-2">
        <span className="bg-positivo-fundo text-positivo grid size-[30px] place-items-center rounded-[9px]">
          <Wallet size={18} aria-hidden />
        </span>
        <h2 className="text-sm font-bold">Hoje dá para gastar</h2>
        <Info
          sobre="hoje dá para gastar"
          texto="Cota do dia mais o cofrinho, menos o que você já gastou hoje."
        />
      </div>

      <span
        className={`text-[36px] leading-none font-bold tracking-[-0.8px] sm:text-[40px] ${estourou ? "text-alerta" : "text-positivo"}`}
      >
        {estourou ? `- ${moeda(-hojeDisponivel)}` : moeda(hojeDisponivel)}
      </span>
      {estourou && (
        <p role="status" className="text-alerta text-[13px] font-semibold">
          Você já gastou além do que o ciclo comporta.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <div
          role="meter"
          aria-label="Gasto de hoje"
          aria-valuenow={Math.round(usado)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="bg-marca-clara h-2 overflow-hidden rounded-full"
        >
          <div
            style={{ width: `${Math.max(usado, 2)}%` }}
            className={`h-full rounded-full ${estourou ? "bg-alerta-forte" : "bg-marca"}`}
          />
        </div>
        <div className="text-tinta-2 flex justify-between text-[13px]">
          <span>gasto hoje {moeda(gastoHoje)}</span>
          <span>de {moeda(Math.max(podiaHoje, 0))}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="bg-superficie-2 border-borda-sutil flex items-center gap-3 rounded-xl border p-3">
          <span className="bg-borda-sutil text-tinta-2 grid size-[30px] shrink-0 place-items-center rounded-[9px]">
            <CalendarDays size={18} strokeWidth={2} aria-hidden />
          </span>
          <span className="flex flex-col">
            <span className="text-tinta-2 flex items-center gap-1 text-[13px]">
              Cota do dia
              <Info
                sobre="cota do dia"
                texto="Livre do ciclo dividido pelos dias do ciclo. Muda quando entra dinheiro ou surge conta fixa nova."
              />
            </span>
            <b className="num text-base">{moeda(cotaDoDia)}</b>
          </span>
        </div>
        <div className="bg-superficie-2 border-borda-sutil flex items-center gap-3 rounded-xl border p-3">
          <span className="bg-marca-clara text-marca grid size-[30px] shrink-0 place-items-center rounded-[9px]">
            <PiggyBank size={18} strokeWidth={2} aria-hidden />
          </span>
          <span className="flex flex-col">
            <span className="text-tinta-2 flex items-center gap-1 text-[13px]">
              Cofrinho
              <Info sobre="cofrinho" texto="O que sobrou ou faltou das cotas dos dias anteriores deste ciclo." />
            </span>
            <b className={`num text-base ${cofrinho < 0 ? "text-alerta" : "text-marca"}`}>{comSinal(cofrinho)}</b>
          </span>
        </div>
      </div>
    </section>
  );
}
