import { buscarResumo } from "./buscar-resumo";
import { ResumoPainel } from "./resumo-painel";

export default async function Home() {
  const resumo = await buscarResumo();

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:px-8">
      <main className="flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <span className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Mercúrio
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Vértice
          </h1>
          <p className="max-w-xl text-base text-zinc-600 dark:text-zinc-400">
            Saldo das suas contas conectadas, em um só lugar.
          </p>
        </header>

        {resumo ? (
          <ResumoPainel resumo={resumo} />
        ) : (
          <p
            role="alert"
            className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
          >
            Não foi possível carregar o resumo financeiro agora. Confira se o
            finance-api está rodando.
          </p>
        )}
      </main>
    </div>
  );
}
