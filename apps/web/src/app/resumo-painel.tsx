import type { ResumoFinanceiro } from "./buscar-resumo";

const DESCRICAO_POR_TITULARIDADE: Record<string, string> = {
  pf: "Contas e cartões pessoais",
  pj: "Recebimentos e despesas do MEI",
};

const formatoMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function ResumoPainel({ resumo }: { resumo: ResumoFinanceiro }) {
  return (
    <>
      <section
        aria-label="Saldos por titularidade"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {resumo.titularidades.map((titularidade) => (
          <article
            key={titularidade.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {titularidade.nome}
            </h2>
            <p className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {formatoMoeda.format(titularidade.saldo)}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {DESCRICAO_POR_TITULARIDADE[titularidade.id]}
            </p>
          </article>
        ))}
      </section>

      <section
        aria-label="Reserva do DAS"
        className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Reserva do DAS ({resumo.reservaDas.referencia})
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Valor separado a partir do recebimento do mês, antes do vencimento.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <p className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {formatoMoeda.format(resumo.reservaDas.valorReservado)}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            previsto para o mês: {formatoMoeda.format(resumo.reservaDas.valorPrevisto)}
          </p>
        </div>
      </section>

      <footer className="text-xs text-zinc-400 dark:text-zinc-600">
        Atualizado em {resumo.atualizadoEm} · dados fictícios
      </footer>
    </>
  );
}
