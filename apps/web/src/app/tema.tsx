"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

export type Escolha = "sistema" | "claro" | "escuro";

const CHAVE = "tema";

/**
 * Roda no <head>, antes da primeira pintura: sem ele a página abriria clara e
 * piscaria para o escuro quando o React montasse.
 */
export const SCRIPT_DO_TEMA = `try{var t=localStorage.getItem("${CHAVE}");var e=t==="escuro"||(t!=="claro"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.tema=e?"escuro":"claro"}catch(_){}`;

function sistemaEscuro(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function aplicar(escolha: Escolha) {
  const escuro = escolha === "escuro" || (escolha === "sistema" && sistemaEscuro());
  document.documentElement.dataset.tema = escuro ? "escuro" : "claro";
}

// Guardar falha em janela anônima ou com o armazenamento bloqueado; o tema
// continua valendo na página aberta, só não fica lembrado.
function lerEscolha(): Escolha {
  try {
    const salvo = localStorage.getItem(CHAVE);
    return salvo === "claro" || salvo === "escuro" ? salvo : "sistema";
  } catch {
    return "sistema";
  }
}

const AVISO = "mercurio:tema";

function guardar(escolha: Escolha) {
  try {
    if (escolha === "sistema") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, escolha);
  } catch {}
  // O evento storage só chega às outras abas; esta precisa do próprio aviso.
  window.dispatchEvent(new Event(AVISO));
}

function assinar(avisar: () => void) {
  window.addEventListener(AVISO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(AVISO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

const OPCOES: { valor: Escolha; rotulo: string; icone: typeof Sun }[] = [
  { valor: "sistema", rotulo: "Seguir o sistema", icone: Monitor },
  { valor: "claro", rotulo: "Tema claro", icone: Sun },
  { valor: "escuro", rotulo: "Tema escuro", icone: Moon },
];

/** Três botões: seguir o sistema, claro ou escuro. A escolha fica no navegador. */
export function SeletorDeTema() {
  // No servidor não há navegador: começa em "sistema" e acerta ao hidratar.
  const escolha = useSyncExternalStore(assinar, lerEscolha, () => "sistema" as const);

  useEffect(() => {
    if (escolha !== "sistema") return;
    // Seguindo o sistema, a troca do Windows ou do celular vale na hora.
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const mudou = () => aplicar("sistema");
    consulta.addEventListener("change", mudou);
    return () => consulta.removeEventListener("change", mudou);
  }, [escolha]);

  function escolher(valor: Escolha) {
    guardar(valor);
    aplicar(valor);
  }

  return (
    <div role="group" aria-label="Tema" className="border-borda bg-superficie inline-flex gap-0.5 rounded-[10px] border p-0.5">
      {OPCOES.map(({ valor, rotulo, icone: Icone }) => (
        <button
          key={valor}
          type="button"
          aria-label={rotulo}
          aria-pressed={escolha === valor}
          title={rotulo}
          onClick={() => escolher(valor)}
          className={`grid size-8 cursor-pointer place-items-center rounded-[8px] ${
            escolha === valor ? "bg-marca-clara text-marca-escura" : "text-tinta-3 hover:text-tinta"
          }`}
        >
          <Icone size={16} strokeWidth={2} aria-hidden />
        </button>
      ))}
    </div>
  );
}
