"use client";

import { LogOut } from "lucide-react";
import { sair } from "./entrar/acoes";

/** Encerra a sessão deste aparelho. No celular só o ícone, ao lado do tema. */
export function BotaoSair({ compacto = false }: { compacto?: boolean }) {
  return (
    <form action={sair}>
      <button
        type="submit"
        aria-label={compacto ? "Sair" : undefined}
        className={
          compacto
            ? "bg-superficie border-borda text-tinta-2 hover:text-marca grid size-8 place-items-center rounded-[9px] border"
            : "text-tinta-2 hover:text-marca flex items-center gap-2 rounded-lg py-1.5 text-[13px]"
        }
      >
        <LogOut size={16} aria-hidden />
        {!compacto && "Sair"}
      </button>
    </form>
  );
}
