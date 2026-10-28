import { TentarDeNovo } from "./tentar-de-novo";

const LISTA = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

/**
 * Faixa no topo da tela quando alguma consulta à API falhou. Diz quais
 * blocos ficaram sem dado: sem ela, bloco vazio parece período sem gasto.
 * Sem falha, não renderiza nada.
 */
export function FaixaDeFalha({ partes }: { partes: string[] }) {
  if (partes.length === 0) {
    return null;
  }
  const varios = partes.length > 1;

  return (
    <div
      role="alert"
      className="bg-aviso-fundo border-aviso-borda text-aviso flex flex-col gap-3 rounded-xl border px-4 py-3 text-[13.5px] sm:flex-row sm:items-start"
    >
      <p className="grow">
        <strong className="text-aviso-forte">Parte dos dados não carregou:</strong>{" "}
        {LISTA.format(partes)}. {varios ? "Esses números ficam indisponíveis" : "Esse número fica indisponível"}{" "}
        até a API responder; nada aqui é zero.
      </p>
      <TentarDeNovo />
    </div>
  );
}

/** A tela inteira sem dado: a API não respondeu nem ao que a tela precisa
 *  para começar, como os ciclos ou o resumo. Mesma faixa da falha parcial. */
export function FalhaTotal() {
  return (
    <div
      role="alert"
      className="bg-aviso-fundo border-aviso-borda text-aviso flex flex-col gap-3 rounded-xl border px-4 py-3 text-[13.5px] sm:flex-row sm:items-start"
    >
      <p className="grow">
        <strong className="text-aviso-forte">A API não respondeu:</strong> nenhum dado desta tela
        carregou. Os números aparecem quando ela voltar; nada aqui é zero.
      </p>
      <TentarDeNovo />
    </div>
  );
}

/** O lugar de um bloco cujo dado não chegou, no lugar do número. */
export function BlocoIndisponivel({ titulo, rotulo }: { titulo: string; rotulo: string }) {
  return (
    <section
      aria-label={rotulo}
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border px-[22px] py-5"
    >
      <h2 className="text-sm font-bold">{titulo}</h2>
      <p className="text-tinta-2 flex flex-col gap-0.5 text-[15px] font-semibold">
        Indisponível
        <span className="text-tinta-3 text-[13px] font-normal">A API não respondeu.</span>
      </p>
    </section>
  );
}
