"use client";

import { LogOut } from "lucide-react";
import { sair } from "./entrar/acoes";

/**
 * Encerra a sessão deste aparelho. Na barra lateral tem a largura e a altura
 * do seletor de tema, logo acima; no celular é só o ícone, ao lado dele.
 */
export function BotaoSair({ compacto = false }: { compacto?: boolean }) {
  return (
    <form action={sair} className={compacto ? undefined : "w-full"}>
      <button
        type="submit"
        aria-label={compacto ? "Sair" : undefined}
        className={
          compacto
            ? "bg-superficie border-borda text-tinta-2 hover:text-marca grid size-8 place-items-center rounded-[9px] border"
            : "border-borda bg-superficie text-tinta-2 hover:text-marca flex h-[38px] w-full items-center justify-center gap-2 rounded-[10px] border text-[13px] font-medium"
        }
      >
        <LogOut size={16} aria-hidden />
        {!compacto && "Sair"}
      </button>
    </form>
  );
}
