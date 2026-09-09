import {
  buscarCiclos,
  buscarFluxoPorConta,
  buscarGastosDiarios,
  buscarMovimentos,
  type Ciclo,
} from "../buscar-movimentos";
import Link from "next/link";
import { buscarResumo } from "../buscar-resumo";
import { diaEMes } from "../formato";
import { CicloContraAnterior, GastoPorConta } from "./comparativo";
import { Filtros } from "./filtros";
import { GraficoGastoDiario } from "./grafico-gasto-diario";
import { Lista } from "./lista";

const CICLOS = ["anterior", "atual", "seguinte"] as const;
type ChaveDeCiclo = (typeof CICLOS)[number];

function chaveValida(valor: string | undefined): ChaveDeCiclo {
  return CICLOS.includes(valor as ChaveDeCiclo) ? (valor as ChaveDeCiclo) : "atual";
}

function umParametro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function paginaValida(valor: string | undefined): number {
  const pagina = Number(valor);
  return Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
}

async function somaDoCiclo(ciclo: Ciclo, contaId: string | undefined): Promise<number> {
  const gastos = await buscarGastosDiarios(ciclo.inicio, ciclo.fim, contaId);
  return gastos?.reduce((soma, gasto) => soma + gasto.total, 0) ?? 0;
}

export default async function Movimentos(props: PageProps<"/movimentos">) {
  const parametros = await props.searchParams;
  const escolhido = chaveValida(umParametro(parametros.ciclo));
  const contaEscolhida = umParametro(parametros.conta);
  const referencia = umParametro(parametros.referencia);
  const pagina = paginaValida(umParametro(parametros.pagina));
  const limite = 50;

  const [ciclos, resumo] = await Promise.all([buscarCiclos(referencia), buscarResumo()]);

  if (ciclos === null) {
    return (
      <p
        role="alert"
        className="bg-superficie border-borda text-tinta-2 rounded-[14px] border p-5 text-sm"
      >
        Não foi possível falar com o finance-api. Confira se ele está rodando.
      </p>
    );
  }

  const ciclo = ciclos[escolhido];
  // O ciclo imediatamente anterior ao escolhido, não o `anterior` fixo da
  // resposta: comparar sempre com o mesmo período tornaria o comparativo
  // errado ao navegar para outro ciclo.
  const anteriorAoEscolhido =
    escolhido === "atual" ? ciclos.anterior : escolhido === "seguinte" ? ciclos.atual : null;

  const [gastos, fluxos, movimentos, somaAnterior] = await Promise.all([
    buscarGastosDiarios(ciclo.inicio, ciclo.fim, contaEscolhida),
    buscarFluxoPorConta(ciclo.inicio, ciclo.fim),
    buscarMovimentos(ciclo.inicio, ciclo.fim, contaEscolhida, limite, (pagina - 1) * limite),
    anteriorAoEscolhido ? somaDoCiclo(anteriorAoEscolhido, contaEscolhida) : Promise.resolve(0),
  ]);

  const gastosDoCiclo = gastos ?? [];
  const somaAtual = gastosDoCiclo.reduce((soma, gasto) => soma + gasto.total, 0);
  const totalEmRevisao = gastosDoCiclo.reduce((soma, gasto) => soma + gasto.emRevisao, 0);
  const contas = resumo?.contas ?? [];
  const fluxosVisiveis = contaEscolhida
    ? (fluxos ?? []).filter((fluxo) => fluxo.contaId === contaEscolhida)
    : (fluxos ?? []);

  return (
    <>
      <header className="flex flex-col gap-[3px]">
        <h1 className="text-[23px] font-bold tracking-[-0.2px]">Movimentos</h1>
        <span className="text-tinta-3 text-[13px]">
          O gráfico e os indicadores cobrem o ciclo selecionado, de {diaEMes(ciclo.inicio)} a{" "}
          {diaEMes(ciclo.fim)}.
        </span>
      </header>

      <Filtros
        ciclos={CICLOS.map((chave) => ({ chave, ciclo: ciclos[chave] }))}
        cicloEscolhido={escolhido}
        contas={contas}
        contaEscolhida={contaEscolhida}
        referencia={referencia}
      />

      {totalEmRevisao > 0 && (
        <p role="status" className="bg-gasto-fundo text-gasto rounded-xl px-4 py-3 text-xs">
          O total inclui {totalEmRevisao.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })} em possíveis duplicidades aguardando revisão.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.6fr_1fr]">
        <GraficoGastoDiario
          gastos={gastosDoCiclo}
          inicio={ciclo.inicio}
          fim={ciclo.fim}
          titulo={`Gasto por dia · Ciclo ${ciclo.numero} (${diaEMes(ciclo.inicio)} a ${diaEMes(ciclo.fim)})`}
        />
        {anteriorAoEscolhido ? (
          <CicloContraAnterior atual={somaAtual} anterior={somaAnterior} numero={ciclo.numero} />
        ) : (
          <GastoPorConta fluxos={fluxosVisiveis} />
        )}
      </div>

      {anteriorAoEscolhido && <GastoPorConta fluxos={fluxosVisiveis} />}

      <Lista movimentos={movimentos ?? []} contas={contas} />

      <nav aria-label="Paginação dos movimentos" className="flex justify-end gap-2">
        {pagina > 1 && (
          <Link
            className="border-borda bg-superficie rounded-lg border px-3 py-2 text-xs"
            href={{
              pathname: "/movimentos",
              query: {
                ciclo: escolhido,
                ...(contaEscolhida ? { conta: contaEscolhida } : {}),
                ...(referencia ? { referencia } : {}),
                pagina: pagina - 1,
              },
            }}
          >
            Página anterior
          </Link>
        )}
        {(movimentos?.length ?? 0) === limite && (
          <Link
            className="border-borda bg-superficie rounded-lg border px-3 py-2 text-xs"
            href={{
              pathname: "/movimentos",
              query: {
                ciclo: escolhido,
                ...(contaEscolhida ? { conta: contaEscolhida } : {}),
                ...(referencia ? { referencia } : {}),
                pagina: pagina + 1,
              },
            }}
          >
            Próxima página
          </Link>
        )}
      </nav>
    </>
  );
}
