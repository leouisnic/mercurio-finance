"use client";

import { type ReactNode, useState } from "react";

export type Aba = {
  chave: string;
  rotulo: string;
  quantidade: number;
  /** Contador em vermelho: há coisa esperando decisão. */
  pede_atencao?: boolean;
  conteudo: ReactNode;
};

/** Recorrências por estado, uma aba por vez, começando pela de decidir. */
export function AbasDeRecorrencias({ abas }: { abas: Aba[] }) {
  const [ativa, setAtiva] = useState(abas[0]?.chave);

  return (
    <div className="flex max-w-[860px] flex-col gap-3.5">
      <div role="tablist" aria-label="Recorrências por estado" className="flex flex-wrap gap-1.5">
        {abas.map((aba) => {
          const selecionada = aba.chave === ativa;
          return (
            <button
              key={aba.chave}
              id={`aba-${aba.chave}`}
              role="tab"
              type="button"
              aria-selected={selecionada}
              aria-controls={`painel-${aba.chave}`}
              onClick={() => setAtiva(aba.chave)}
              className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm ${
                selecionada
                  ? "bg-tinta border-tinta font-semibold text-white"
                  : "bg-superficie border-borda text-tinta-2 hover:bg-superficie-2"
              }`}
            >
              {aba.rotulo}
              <span
                className={`num grid h-[22px] min-w-[22px] place-items-center rounded-full px-1.5 text-xs font-bold ${
                  aba.pede_atencao && aba.quantidade > 0
                    ? "bg-alerta-forte text-white"
                    : selecionada
                      ? "text-tinta bg-white"
                      : "bg-borda text-tinta-2"
                }`}
              >
                {aba.quantidade}
              </span>
            </button>
          );
        })}
      </div>
      {abas.map((aba) => (
        <section
          key={aba.chave}
          id={`painel-${aba.chave}`}
          role="tabpanel"
          aria-labelledby={`aba-${aba.chave}`}
          hidden={aba.chave !== ativa}
          className="flex flex-col gap-3"
        >
          {aba.conteudo}
        </section>
      ))}
    </div>
  );
}
