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
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border p-5"
    >
      <div className="flex items-center gap-2">
        <span className="bg-positivo-fundo text-positivo grid size-8 place-items-center rounded-[9px]">
          <Wallet size={18} aria-hidden />
        </span>
        <h2 className="text-tinta-3 text-xs font-semibold tracking-[0.06em] uppercase">
          Hoje dá para gastar
        </h2>
        <Info
          sobre="hoje dá para gastar"
          texto="Cota do dia mais o cofrinho, menos o que você já gastou hoje."
        />
      </div>

      <span
        className={`text-[44px] leading-none font-bold tracking-[-1px] sm:text-[50px] ${estourou ? "text-alerta" : "text-positivo"}`}
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
        <div className="text-tinta-3 flex justify-between text-xs">
          <span>gasto hoje {moeda(gastoHoje)}</span>
          <span>de {moeda(Math.max(podiaHoje, 0))}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-superficie-2 border-borda-sutil flex flex-col gap-0.5 rounded-xl border px-3 py-2.5">
          <span className="text-tinta-3 flex items-center gap-1.5 text-xs">
            <CalendarDays size={14} aria-hidden />
            Cota do dia
            <Info
              sobre="cota do dia"
              texto="Livre do ciclo dividido pelos dias do ciclo. Muda quando entra dinheiro ou surge conta fixa nova."
            />
          </span>
          <b className="num text-[17px]">{moeda(cotaDoDia)}</b>
        </div>
        <div className="bg-superficie-2 border-borda-sutil flex flex-col gap-0.5 rounded-xl border px-3 py-2.5">
          <span className="text-tinta-3 flex items-center gap-1.5 text-xs">
            <PiggyBank size={14} aria-hidden />
            Cofrinho
            <Info
              sobre="cofrinho"
              texto="O que sobrou ou faltou das cotas dos dias anteriores deste ciclo."
            />
          </span>
          <b className={`num text-[17px] ${cofrinho < 0 ? "text-alerta" : "text-marca"}`}>
            {comSinal(cofrinho)}
          </b>
        </div>
      </div>
    </section>
  );
}
