import type { Conta, ResumoFinanceiro } from "./buscar-resumo";

const formatoMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function CartaoConta({ conta }: { conta: Conta }) {
  const eCartaoDeCredito = conta.tipo === "CREDIT";

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{conta.nome}</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {eCartaoDeCredito ? "Fatura atual" : "Saldo"}
      </p>
      <p
        className={
          eCartaoDeCredito
            ? "text-2xl font-semibold text-amber-600 dark:text-amber-400"
            : "text-2xl font-semibold text-emerald-600 dark:text-emerald-400"
        }
      >
        {formatoMoeda.format(conta.saldo)}
      </p>
      {eCartaoDeCredito && conta.limite !== null && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {conta.disponivel !== null
            ? `${formatoMoeda.format(conta.disponivel)} disponível de ${formatoMoeda.format(conta.limite)}`
            : `limite de ${formatoMoeda.format(conta.limite)}`}
        </p>
      )}
    </article>
  );
}

export function ResumoPainel({ resumo }: { resumo: ResumoFinanceiro }) {
  return (
    <>
      <section
        aria-label="Contas conectadas"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {resumo.contas.map((conta) => (
          <CartaoConta key={conta.id} conta={conta} />
        ))}
      </section>

      <footer className="text-xs text-zinc-400 dark:text-zinc-600">
        Atualizado em {resumo.atualizadoEm}
      </footer>
    </>
  );
}
