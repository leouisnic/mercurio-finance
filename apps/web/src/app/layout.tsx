import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { BarraLateral } from "./barra-lateral";
import { ProvedorDeDicas } from "./info";
import { SCRIPT_DO_TEMA } from "./tema";
import { buscarParaClassificar } from "./buscar-movimentos";
import { dataDeHoje } from "./hoje";

const sora = localFont({
  src: "./fonts/Sora-Variable.ttf",
  variable: "--font-sora",
  display: "swap",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: "Mercúrio",
  description: "Quanto dá para gastar até o próximo pagamento, com as contas conectadas por Open Finance.",
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // O número de "Para classificar" do submenu. Falha da API só esconde o número.
  const paraClassificar = await buscarParaClassificar(dataDeHoje());

  return (
    // O script do tema muda data-tema antes da hidratação, de propósito.
    <html lang="pt-BR" className={`${sora.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      </head>
      <body className="bg-fundo text-tinta flex min-h-full flex-col font-sans md:flex-row">
        <ProvedorDeDicas>
          <BarraLateral paraClassificar={paraClassificar} />
          <div className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-6 pb-24 sm:px-9 md:py-7">{children}</div>
        </ProvedorDeDicas>
      </body>
    </html>
  );
}
