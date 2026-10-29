"use client";

import { Popover } from "radix-ui";
import { type ReactElement, useState } from "react";
import type { GastoDoDetalhe } from "./buscar-movimentos";
import { comoData, moeda } from "./formato";

const DIA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

/**
 * A coluna de um dia num gráfico de gasto, com o detalhe no padrão do
 * Mercúrio no lugar da dica do navegador. A coluna inteira é o alvo do mouse
 * e do toque, mas o detalhe se prende à barra (`Popover.Anchor`): preso à
 * coluna, ele abria no topo do gráfico, longe da barra. Abre ao passar o
 * mouse, no foco do teclado e no toque, porque no celular não existe mouse.
 */
export function ColunaComDetalhe({
  data,
  valor,
  cota = null,
  maiores,
  children,
}: {
  data: string;
  valor: number;
  /** Sem cota (ciclo passado), o detalhe não fala de cota. */
  cota?: number | null;
  maiores: GastoDoDetalhe[];
  /** A barra: é nela que o detalhe se prende. */
  children: ReactElement;
}) {
  const [aberto, setAberto] = useState(false);
  const dia = DIA.format(comoData(data)).replace(".", "");
  const acima = cota !== null ? valor - cota : 0;

  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <button
        type="button"
        aria-label={`${dia}: ${moeda(valor)}`}
        aria-expanded={aberto}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onClick={() => setAberto((atual) => !atual)}
        className="group focus-visible:outline-marca flex h-full w-full min-w-0 cursor-pointer items-end justify-center rounded-t focus-visible:outline-2"
      >
        <Popover.Anchor asChild>{children}</Popover.Anchor>
      </button>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(evento) => evento.preventDefault()}
          onCloseAutoFocus={(evento) => evento.preventDefault()}
          className="bg-superficie border-borda text-tinta-2 pointer-events-none z-50 flex w-max max-w-[320px] flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-[12.5px] shadow-lg"
        >
          <b className="text-tinta first-letter:uppercase">{dia}</b>
          {valor === 0 ? (
            <>
              <span className="text-positivo text-[14px] font-bold whitespace-nowrap">
                {cota !== null && cota > 0
                  ? `Dia sem gasto: ${moeda(cota)} para o cofrinho`
                  : "Dia sem gasto"}
              </span>
            </>
          ) : (
            <>
              <span
                className={`num text-lg font-bold ${acima > 0 ? "text-alerta" : "text-tinta"}`}
              >
                {moeda(valor)}
              </span>
              {acima > 0 && (
                <span className="text-alerta">
                  {moeda(acima)} acima da cota
                </span>
              )}
            </>
          )}
          {maiores.length > 0 && (
            <ul className="border-borda-sutil mt-1.5 flex flex-col gap-1 border-t pt-1.5">
              {maiores.map((item, indice) => (
                <li
                  key={`${item.descricao}-${indice}`}
                  className="flex justify-between gap-3"
                >
                  <span className="truncate">{item.descricao}</span>
                  <b className="num text-gasto shrink-0">{moeda(item.valor)}</b>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
