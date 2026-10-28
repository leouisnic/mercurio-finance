import { buscarRecorrencias, type Recorrencia, type StatusRecorrencia } from "../buscar-recorrencias";
import { buscarResumo } from "../buscar-resumo";
import { FaixaDeFalha, FalhaTotal } from "../indisponivel";
import { Info } from "../info";
import { AbasDeRecorrencias, type Aba } from "./abas";
import { CartaoDecidido, CartaoPendente } from "./cartao";

const ABAS: { chave: StatusRecorrencia; rotulo: string; vazio: string }[] = [
  { chave: "pendente", rotulo: "Para decidir", vazio: "Nada esperando decisão." },
  { chave: "aprovada", rotulo: "Contas fixas", vazio: "Nenhuma conta fixa." },
  { chave: "parcelamento", rotulo: "Parcelamentos", vazio: "Nenhum parcelamento." },
  { chave: "encerrada", rotulo: "Encerradas", vazio: "Nenhuma encerrada." },
  { chave: "rejeitada", rotulo: "Não é recorrência", vazio: "Nenhuma." },
];

function Titulo() {
  return (
    <header className="flex items-center gap-1">
      <h1 className="text-[23px] font-bold tracking-[-0.2px]">Recorrências</h1>
      <Info
        sobre="recorrências"
        texto="Cobranças que se repetem no extrato. Você decide se é conta fixa, parcelamento, se já acabou ou se não é recorrência."
      />
    </header>
  );
}

export default async function Recorrencias() {
  const [recorrencias, resumo] = await Promise.all([buscarRecorrencias(), buscarResumo()]);

  if (recorrencias === null) {
    return (
      <>
        <Titulo />
        <FalhaTotal />
      </>
    );
  }

  const contaPor = new Map((resumo?.contas ?? []).map((conta) => [conta.id, conta]));
  const porEstado = (status: StatusRecorrencia): Recorrencia[] =>
    recorrencias.filter((recorrencia) => recorrencia.status === status);

  const abas: Aba[] = ABAS.map(({ chave, rotulo, vazio }) => {
    const lista = porEstado(chave);
    return {
      chave,
      rotulo,
      quantidade: lista.length,
      pede_atencao: chave === "pendente",
      conteudo:
        lista.length === 0 ? (
          <p className="text-tinta-2 text-sm">{vazio}</p>
        ) : (
          lista.map((recorrencia) =>
            chave === "pendente" ? (
              <CartaoPendente
                key={recorrencia.id}
                recorrencia={recorrencia}
                conta={contaPor.get(recorrencia.contaId)}
              />
            ) : (
              <CartaoDecidido
                key={recorrencia.id}
                recorrencia={recorrencia}
                conta={contaPor.get(recorrencia.contaId)}
              />
            ),
          )
        ),
    };
  });

  return (
    <>
      <Titulo />
      <FaixaDeFalha partes={resumo === null ? ["nomes das contas"] : []} />
      <AbasDeRecorrencias abas={abas} />
    </>
  );
}
