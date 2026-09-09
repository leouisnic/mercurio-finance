"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "./logo";

type Item = {
  href: string;
  rotulo: string;
  icone: ReactNode;
  /** Tela ainda não construída: aparece na barra mas não navega. */
  futura?: boolean;
};

const traco = {
  fill: "none",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const ITENS: Item[] = [
  {
    href: "/",
    rotulo: "Visão geral",
    icone: (
      <svg viewBox="0 0 24 24" stroke="currentColor" {...traco}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/movimentos",
    rotulo: "Movimentos",
    icone: (
      <svg viewBox="0 0 24 24" stroke="currentColor" {...traco}>
        <path d="M4 17 L10 11 L14 15 L20 7" />
        <path d="M14 7 L20 7 L20 13" />
      </svg>
    ),
  },
  {
    href: "/contas-fixas",
    rotulo: "Contas fixas",
    futura: true,
    icone: (
      <svg viewBox="0 0 24 24" stroke="currentColor" {...traco}>
        <rect x="3" y="4" width="18" height="17" rx="2.5" />
        <path d="M3 9 L21 9" />
        <path d="M9 9 L9 21" />
        <path d="M15 9 L15 21" />
      </svg>
    ),
  },
];

function Item({ item, ativo }: { item: Item; ativo: boolean }) {
  const conteudo = (
    <>
      <span className="size-[17px] shrink-0">{item.icone}</span>
      <span className="text-[13px]">{item.rotulo}</span>
    </>
  );

  if (item.futura) {
    return (
      <span
        aria-disabled
        title="Ainda não construída"
        className="text-tinta-4 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 font-medium"
      >
        {conteudo}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={
        ativo
          ? "bg-marca-clara text-marca-escura flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 font-semibold"
          : "text-tinta-2 hover:bg-superficie flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 font-medium"
      }
    >
      {conteudo}
    </Link>
  );
}

export function BarraLateral() {
  const caminho = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-superficie-2 border-borda flex w-[232px] shrink-0 flex-col border-r px-4 py-6"
    >
      <Link href="/" className="flex items-center gap-2.5 px-2 pt-1 pb-7">
        <span className="bg-marca flex size-8 shrink-0 items-center justify-center rounded-[9px]">
          <Logo />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[17px] font-bold tracking-[0.1px]">Vértice</span>
          <span className="text-tinta-3 text-[10.5px]">por Mercúrio</span>
        </span>
      </Link>

      <div className="flex flex-col gap-0.5">
        {ITENS.map((item) => (
          <Item key={item.href} item={item} ativo={caminho === item.href} />
        ))}
      </div>
    </nav>
  );
}
