"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ContaParaClassificar, SUBPAGINAS } from "./movimentos/abas";
import { SeletorDeTema } from "./tema";

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
    rotulo: "Início",
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
    href: "/recorrencias",
    rotulo: "Recorrências",
    icone: (
      <svg viewBox="0 0 24 24" stroke="currentColor" {...traco}>
        <path d="M3 12a9 9 0 0 1 15.5-6.2" />
        <path d="M21 12a9 9 0 0 1-15.5 6.2" />
        <path d="M19 3v5h-5" />
        <path d="M5 21v-5h5" />
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

/** No celular, a barra embaixo: as quatro telas ao alcance do polegar. */
function ItemDoCelular({ item, ativo }: { item: Item; ativo: boolean }) {
  const conteudo = (
    <>
      <span
        className={`flex h-7 w-12 items-center justify-center rounded-full ${ativo ? "bg-marca-clara" : ""}`}
      >
        <span className="size-5">{item.icone}</span>
      </span>
      <span className="text-[12px]">{item.rotulo.split(" ")[0]}</span>
    </>
  );
  const classe = "flex flex-1 flex-col items-center justify-center gap-0.5";

  if (item.futura) {
    return (
      <span aria-disabled title="Ainda não construída" className={`${classe} text-tinta-4`}>
        {conteudo}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={`${classe} ${ativo ? "text-marca-escura font-semibold" : "text-tinta-2"}`}
    >
      {conteudo}
    </Link>
  );
}

/** A tela do item: Movimentos continua marcado nas páginas de dentro dele. */
function estaEm(caminho: string, href: string): boolean {
  return href === "/" ? caminho === "/" : caminho === href || caminho.startsWith(`${href}/`);
}

/** As páginas de dentro de Movimentos, só os títulos recuados, à vista
 *  enquanto se está em Movimentos. A principal é o próprio item. */
function Submenu({ caminho, paraClassificar }: { caminho: string; paraClassificar: number | null }) {
  return (
    <div className="flex flex-col gap-0.5 pt-0.5 pb-1">
      {SUBPAGINAS.slice(1).map((pagina) => {
        const ativa = caminho === pagina.href;
        return (
          <Link
            key={pagina.href}
            href={pagina.href}
            aria-current={ativa ? "page" : undefined}
            className={`flex items-center justify-between gap-2 rounded-[9px] py-2 pr-2.5 pl-[38px] text-[13px] ${
              ativa ? "text-marca-escura font-semibold" : "text-tinta-2 hover:bg-superficie font-medium"
            }`}
          >
            {pagina.rotulo}
            {pagina.href === "/movimentos/classificar" && <ContaParaClassificar total={paraClassificar} />}
          </Link>
        );
      })}
    </div>
  );
}

export function BarraLateral({ paraClassificar = null }: { paraClassificar?: number | null }) {
  const caminho = usePathname();

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="bg-superficie-2 border-borda sticky top-0 flex h-dvh w-[232px] shrink-0 flex-col border-r px-4 py-6 max-md:hidden"
      >
        <Link href="/" className="flex items-center gap-2.5 px-2 pt-1 pb-7">
          {/* A ilustração índigo some no fundo escuro: lá entra a versão prateada. */}
          <Image src="/marca/ilustracao.png" alt="" width={40} height={40} loading="eager" className="dark:hidden" />
          <Image src="/marca/ilustracao-escura.png" alt="" width={40} height={40} loading="eager" className="hidden dark:block" />
          <span className="text-[18px] font-bold tracking-[0.1px]">Mercúrio</span>
        </Link>

        <div className="flex flex-col gap-0.5">
          {ITENS.map((item) => (
            <div key={item.href} className="flex flex-col">
              <Item item={item} ativo={estaEm(caminho, item.href)} />
              {item.href === "/movimentos" && estaEm(caminho, item.href) && (
                <Submenu caminho={caminho} paraClassificar={paraClassificar} />
              )}
            </div>
          ))}
        </div>

        <div className="mt-auto px-2 pt-6">
          <SeletorDeTema />
        </div>
      </nav>

      <header className="bg-superficie-2 border-borda sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/marca/icone.png" alt="" width={26} height={26} loading="eager" className="dark:hidden" />
          <Image src="/marca/icone-escuro.png" alt="" width={26} height={26} loading="eager" className="hidden dark:block" />
          <span className="text-base font-bold">Mercúrio</span>
        </Link>
        <SeletorDeTema />
      </header>

      <nav
        aria-label="Navegação principal"
        className="bg-superficie border-borda fixed inset-x-0 bottom-0 z-20 flex h-16 border-t md:hidden"
      >
        {ITENS.map((item) => (
          <ItemDoCelular key={item.href} item={item} ativo={estaEm(caminho, item.href)} />
        ))}
      </nav>
    </>
  );
}
