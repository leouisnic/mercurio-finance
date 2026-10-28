"use client";

import { Info as IconeInfo } from "lucide-react";
import { Tooltip } from "radix-ui";
import { useState, type ReactNode } from "react";

/** Os balões de informação dividem a mesma espera para abrir. */
export function ProvedorDeDicas({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delayDuration={200}>{children}</Tooltip.Provider>;
}

/**
 * Ícone que explica um número em uma frase. O toque abre e fecha, porque no
 * celular não existe passar o mouse, e o Tooltip do Radix só abre por
 * ponteiro e foco.
 */
export function Info({ sobre, texto }: { sobre: string; texto: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <Tooltip.Root open={aberto} onOpenChange={setAberto}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={`O que é ${sobre}`}
          onClick={() => setAberto((atual) => !atual)}
          className="text-tinta-3 hover:text-marca focus-visible:text-marca inline-grid size-6 shrink-0 cursor-help place-items-center rounded-full align-middle"
        >
          <IconeInfo size={14} aria-hidden />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={4}
          collisionPadding={12}
          className="bg-tinta z-50 max-w-[240px] rounded-lg px-2.5 py-2 text-[13px] leading-snug font-normal tracking-normal text-superficie normal-case"
        >
          {texto}
          <Tooltip.Arrow className="fill-tinta" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
