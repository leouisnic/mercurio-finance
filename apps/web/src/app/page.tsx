type Titularidade = {
  id: "pf" | "pj" | "mei";
  nome: string;
  descricao: string;
  saldo: number;
};

type ResumoFicticio = {
  atualizadoEm: string;
  titularidades: Titularidade[];
  reservaDas: {
    referencia: string;
    valorReservado: number;
    valorPrevisto: number;
  };
};

// Dados fictícios de desenvolvimento. A integração com o finance-api entra em
// uma etapa posterior.
const resumo: ResumoFicticio = {
  atualizadoEm: "2026-09-02",
  titularidades: [
    { id: "pf", nome: "Pessoa Física", descricao: "Contas e cartões pessoais", saldo: 4230.5 },
    { id: "pj", nome: "Pessoa Jurídica", descricao: "Recebimentos e despesas do negócio", saldo: 12890.15 },
    { id: "mei", nome: "MEI", descricao: "Enquadramento e obrigações do MEI", saldo: 980.0 },
  ],
  reservaDas: {
    referencia: "competência atual",
    valorReservado: 620.0,
    valorPrevisto: 650.0,
  },
};

const formatoMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function Home() {
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
            Painel consolidado de PF, PJ e MEI. Os valores abaixo são fictícios,
            usados apenas para desenvolvimento local.
          </p>
        </header>

        <section
          aria-label="Saldos por titularidade"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
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
                {titularidade.descricao}
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
      </main>
    </div>
  );
}
