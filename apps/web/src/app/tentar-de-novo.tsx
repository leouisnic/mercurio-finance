"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Busca de novo os dados da tela sem recarregar a página inteira. */
export function TentarDeNovo() {
  const router = useRouter();
  const [buscando, iniciar] = useTransition();

  return (
    <button
      type="button"
      onClick={() => iniciar(() => router.refresh())}
      disabled={buscando}
      className="bg-superficie border-borda text-tinta-2 hover:bg-superficie-2 shrink-0 cursor-pointer self-start rounded-[9px] border px-3.5 py-2 text-[13px] font-semibold disabled:cursor-wait disabled:opacity-60"
    >
      {buscando ? "Buscando..." : "Tentar de novo"}
    </button>
  );
}
