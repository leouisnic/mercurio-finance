"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** As páginas de dentro de Movimentos. No computador, a primeira é o próprio
 *  item Movimentos e o submenu mostra só as outras; no celular viram abas no
 *  topo, porque a barra de baixo não tem espaço, e a primeira precisa de nome. */
export const SUBPAGINAS = [
  { href: "/movimentos", rotulo: "Resumo" },
  { href: "/movimentos/classificar", rotulo: "Para classificar" },
  { href: "/movimentos/tags", rotulo: "Tags" },
] as const;

export function ContaParaClassificar({ total }: { total: number | null }) {
  if (!total) {
    return null;
  }
  return (
    <span className="border-aviso-borda bg-aviso-fundo text-aviso rounded-full border px-1.5 text-[11.5px] font-bold">
      {total}
    </span>
  );
}

export function AbasDeMovimentos({ paraClassificar }: { paraClassificar: number | null }) {
  const caminho = usePathname();
  return (
    <nav aria-label="Páginas de Movimentos" className="border-borda flex gap-1 border-b md:hidden">
      {SUBPAGINAS.map((pagina) => {
        const ativa = caminho === pagina.href;
        return (
          <Link
            key={pagina.href}
            href={pagina.href}
            aria-current={ativa ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] ${
              ativa ? "border-marca text-marca font-bold" : "text-tinta-2 border-transparent"
            }`}
          >
            {pagina.rotulo}
            {pagina.href === "/movimentos/classificar" && <ContaParaClassificar total={paraClassificar} />}
          </Link>
        );
      })}
    </nav>
  );
}
