import type { Metadata } from "next";
import Image from "next/image";
import { FormularioDeEntrada } from "./formulario";

export const metadata: Metadata = { title: "Entrar · Mercúrio" };

/** Decisão visual da spec da senha do painel: cartão no centro. */
export default function Entrar() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="bg-superficie border-borda flex w-full max-w-[360px] flex-col gap-4 rounded-[18px] border px-6 py-7">
        <div className="flex flex-col items-center gap-2 text-center">
          {/* A ilustração índigo some no fundo escuro: lá entra a versão prateada. */}
          <Image
            src="/marca/ilustracao.png"
            alt=""
            width={56}
            height={56}
            loading="eager"
            className="dark:hidden"
          />
          <Image
            src="/marca/ilustracao-escura.png"
            alt=""
            width={56}
            height={56}
            loading="eager"
            className="hidden dark:block"
          />
          <h1 className="text-xl font-bold">Mercúrio</h1>
        </div>
        <FormularioDeEntrada />
      </div>
    </main>
  );
}
