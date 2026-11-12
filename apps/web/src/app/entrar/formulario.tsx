"use client";

import { useActionState, useState } from "react";
import { entrar } from "./acoes";
import { ENTRADA_INICIAL } from "./estado";

export function FormularioDeEntrada() {
  const [estado, enviar, enviando] = useActionState(entrar, ENTRADA_INICIAL);
  const [mostrar, setMostrar] = useState(false);
  const esperando = estado.esperaMinutos > 0;

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <label className="text-tinta-2 flex flex-col gap-1.5 text-[13px] font-semibold">
        Senha
        <span
          className={`bg-superficie-2 flex h-11 items-center rounded-[10px] border pr-1.5 pl-3 focus-within:ring-2 focus-within:ring-marca ${estado.erro ? "border-alerta" : "border-borda"}`}
        >
          <input
            name="senha"
            type={mostrar ? "text" : "password"}
            autoComplete="current-password"
            required
            autoFocus
            disabled={esperando}
            aria-invalid={estado.erro ? true : undefined}
            className="text-tinta min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          />
          <button
            type="button"
            onClick={() => setMostrar((atual) => !atual)}
            className="text-tinta-3 hover:text-marca rounded-md px-1.5 py-1 text-xs font-semibold"
          >
            {mostrar ? "Esconder" : "Mostrar"}
          </button>
        </span>
      </label>

      {estado.erro && (
        <p role="alert" className="bg-alerta-fundo text-alerta rounded-[10px] px-3 py-2 text-[13px]">
          {estado.erro}
        </p>
      )}
      {esperando && (
        <p role="alert" className="bg-aviso-fundo text-aviso rounded-[10px] px-3 py-2 text-[13px]">
          Muitas tentativas erradas. Tente de novo em{" "}
          {estado.esperaMinutos === 1 ? "1 minuto" : `${estado.esperaMinutos} minutos`}.
        </p>
      )}

      <button
        type="submit"
        disabled={esperando || enviando}
        className="bg-marca text-sobre-cor h-11 rounded-[10px] text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
      >
        Entrar
      </button>
      <p className="text-tinta-3 text-center text-[12.5px]">
        Este aparelho fica conectado por 30 dias.
      </p>
    </form>
  );
}
