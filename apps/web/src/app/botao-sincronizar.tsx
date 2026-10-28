"use client";

import { useActionState } from "react";
import { sincronizar, type ResultadoDaAcao } from "./acoes";

/** Pede a sincronização e mostra quando o pedido nem chegou à API. */
export function BotaoSincronizar() {
  const [resultado, acao, pendente] = useActionState<ResultadoDaAcao>(sincronizar, {
    erro: null,
  });

  return (
    <form action={acao} className="flex flex-col items-end gap-1.5">
      <button
        type="submit"
        disabled={pendente}
        className="bg-superficie border-borda text-tinta-2 hover:bg-superficie-2 h-10 cursor-pointer rounded-[10px] border px-4 text-[13px] font-semibold disabled:cursor-wait disabled:opacity-60"
      >
        {pendente ? "Pedindo..." : "Sincronizar"}
      </button>
      {resultado.erro && (
        <p role="alert" className="text-alerta max-w-[280px] text-right text-[13px]">
          {resultado.erro}
        </p>
      )}
    </form>
  );
}
