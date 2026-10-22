import { buscarRecorrencias } from "../buscar-recorrencias";
import { buscarResumo } from "../buscar-resumo";
import { BlocoIndisponivel, FaixaDeFalha, FalhaTotal } from "../indisponivel";
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
      <>
        <header className="flex flex-col gap-[3px]">
          <h1 className="text-[23px] font-bold tracking-[-0.2px]">Recorrências</h1>
        </header>
        <FalhaTotal />
      </>
    );
  }

  const contaPor = new Map((resumo?.contas ?? []).map((conta) => [conta.id, conta]));
  // Lista parcial pareceria completa: se um dos dois status falhou, a seção
  // inteira fica indisponível em vez de mostrar só metade.
  const decididas = aprovadas && rejeitadas ? [...aprovadas, ...rejeitadas] : null;
  const falhas = [
    decididas === null && "recorrências já decididas",
    resumo === null && "nomes das contas",
  ].filter((parte): parte is string => typeof parte === "string");

  return (
    <>
      <header className="flex flex-col gap-[3px]">
        <h1 className="text-[23px] font-bold tracking-[-0.2px]">Recorrências</h1>
        <span className="text-tinta-3 text-[13px]">
          A detecção sugere, você decide. Uma cobrança mensal de mesmo valor tanto pode ser
          assinatura quanto parcelamento com prazo, e só quem viveu o gasto sabe a diferença.
        </span>
      </header>

      <FaixaDeFalha partes={falhas} />

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

      {decididas === null && (
        <BlocoIndisponivel titulo="Já decididas" rotulo="Já decididas" />
      )}

      {decididas && decididas.length > 0 && (
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
