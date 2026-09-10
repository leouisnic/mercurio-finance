import { SeloDoBanco, nomeDaConta } from "../banco";
import type { Movimento } from "../buscar-movimentos";
import type { Conta } from "../buscar-resumo";
import { diaEMes, moeda } from "../formato";

/** Transferência entre contas do mesmo titular não é entrada nem saída. */
const ENTRADAS = new Set(["receita"]);
const SAIDAS = new Set(["despesa"]);

function corDoValor(tipo: string): string {
  if (ENTRADAS.has(tipo)) return "text-positivo";
  return SAIDAS.has(tipo) ? "text-gasto" : "text-tinta-3";
}

function sinalDoValor(tipo: string): string {
  if (ENTRADAS.has(tipo)) return "+ ";
  return SAIDAS.has(tipo) ? "- " : "";
}

const COLUNAS = "grid grid-cols-[92px_1fr_200px_130px] gap-3 px-[22px]";

export function Lista({ movimentos, contas }: { movimentos: Movimento[]; contas: Conta[] }) {
  const porId = new Map(contas.map((conta) => [conta.id, conta]));

  return (
    <section
      aria-label="Movimentos"
      className="bg-superficie border-borda flex flex-col overflow-hidden rounded-2xl border"
    >
      <div className={`${COLUNAS} bg-superficie-2 border-borda border-b py-3`}>
        {["Data", "Descrição", "Conta", "Valor"].map((titulo) => (
          <span
            key={titulo}
            className={`text-tinta-3 text-[11px] font-semibold tracking-[0.04em] uppercase ${titulo === "Valor" ? "text-right" : ""}`}
          >
            {titulo}
          </span>
        ))}
      </div>

      {movimentos.length === 0 ? (
        <p className="text-tinta-3 px-[22px] py-8 text-center text-[13px]">
          Nenhum movimento neste recorte.
        </p>
      ) : (
        movimentos.map((movimento) => {
          const conta = porId.get(movimento.contaId);
          return (
            <div
              key={movimento.id}
              className={`${COLUNAS} border-borda-sutil items-center border-b py-3 last:border-b-0`}
            >
              <span className="num text-tinta-2 text-xs">{diaEMes(movimento.data)}</span>

              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13.5px]">{movimento.descricao}</span>
                {movimento.pagamentoDeFatura !== null &&
                  movimento.pagamentoDeFatura !== "descartado" && (
                    <span className="text-tinta-3 text-[10.5px]">
                      pagamento de fatura, fora das somas de gasto
                    </span>
                  )}
                {movimento.duplicadoPossivel && (
                  <span className="text-gasto text-[10.5px]">
                    possível duplicidade, valor incluído no total
                  </span>
                )}
              </span>

              <span className="flex min-w-0 items-center gap-2">
                {conta && <SeloDoBanco conta={conta} tamanho={22} />}
                <span className="text-tinta-2 truncate text-[12.5px]">
                  {conta
                    ? `${nomeDaConta(conta)} · ${conta.tipo === "CREDIT" ? "Cartão" : "Conta"}`
                    : movimento.contaId}
                </span>
              </span>

              <span
                className={`num text-right text-[13.5px] font-semibold ${corDoValor(movimento.tipo)}`}
              >
                {sinalDoValor(movimento.tipo)}
                {moeda(movimento.valor)}
              </span>
            </div>
          );
        })
      )}
    </section>
  );
}
