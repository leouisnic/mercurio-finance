import { buscarRecorrencias } from "../buscar-recorrencias";
import { buscarResumo } from "../buscar-resumo";
import { CartaoPendente, LinhaDecidida } from "./cartao";

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-tinta-3 text-xs font-semibold tracking-[0.06em] uppercase">{titulo}</h2>
        {descricao && <span className="text-tinta-3 text-[12px]">{descricao}</span>}
      </div>
      {children}
    </section>
  );
}

export default async function Recorrencias() {
  const [pendentes, aprovadas, rejeitadas, resumo] = await Promise.all([
    buscarRecorrencias("pendente"),
    buscarRecorrencias("aprovada"),
    buscarRecorrencias("rejeitada"),
    buscarResumo(),
  ]);

  if (pendentes === null) {
    return (
      <p
        role="alert"
        className="bg-superficie border-borda text-tinta-2 rounded-[14px] border p-5 text-sm"
      >
        Não foi possível falar com o finance-api. Confira se ele está rodando.
      </p>
    );
  }

  const contaPor = new Map((resumo?.contas ?? []).map((conta) => [conta.id, conta]));
  const decididas = [...(aprovadas ?? []), ...(rejeitadas ?? [])];

  return (
    <>
      <header className="flex flex-col gap-[3px]">
        <h1 className="text-[23px] font-bold tracking-[-0.2px]">Recorrências</h1>
        <span className="text-tinta-3 text-[13px]">
          A detecção sugere, você decide. Uma cobrança mensal de mesmo valor tanto pode ser
          assinatura quanto parcelamento com prazo, e só quem viveu o gasto sabe a diferença.
        </span>
      </header>

      <Secao
        titulo="Esperando decisão"
        descricao={
          pendentes.length > 0
            ? "Aprovar já classificando é uma ação só. Rejeitar é definitivo: a detecção não devolve a recorrência para esta fila."
            : undefined
        }
      >
        {pendentes.length === 0 ? (
          <p className="bg-superficie border-borda text-tinta-3 rounded-2xl border px-[22px] py-8 text-center text-[13px]">
            Nenhuma candidata esperando. A detecção roda a cada sincronização.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendentes.map((recorrencia) => (
              <CartaoPendente
                key={recorrencia.id}
                recorrencia={recorrencia}
                conta={contaPor.get(recorrencia.contaId)}
              />
            ))}
          </div>
        )}
      </Secao>

      {decididas.length > 0 && (
        <Secao titulo="Já decididas" descricao="Dá para voltar atrás a qualquer momento.">
          <div className="bg-superficie border-borda flex flex-col overflow-hidden rounded-2xl border">
            {decididas.map((recorrencia) => (
              <LinhaDecidida
                key={recorrencia.id}
                recorrencia={recorrencia}
                conta={contaPor.get(recorrencia.contaId)}
              />
            ))}
          </div>
        </Secao>
      )}
    </>
  );
}
