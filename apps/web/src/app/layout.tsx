import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { BarraLateral } from "./barra-lateral";

const sora = localFont({
  src: "./fonts/Sora-Variable.ttf",
  variable: "--font-sora",
  display: "swap",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: "Vértice",
  description: "Painel consolidado do Mercúrio: saldo das suas contas conectadas.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${sora.variable} h-full antialiased`}>
      <body className="bg-fundo text-tinta flex min-h-full font-sans">
        <BarraLateral />
        <div className="flex min-w-0 flex-1 flex-col gap-5 px-6 py-7 sm:px-9">{children}</div>
      </body>
    </html>
  );
}
