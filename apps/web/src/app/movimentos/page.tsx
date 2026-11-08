import {
  buscarCategorias,
  buscarCiclos,
  buscarContadores,
  buscarFluxoPorConta,
  buscarGastosDiarios,
  buscarMovimentos,
  buscarParaClassificar,
  buscarTags,
  type Ciclo,
  type FiltroDaApi,
} from "../buscar-movimentos";
import Link from "next/link";
import { BarraDeFiltros } from "../barra-de-filtros";
import { buscarDiasNaoUteis } from "../buscar-feriados";
import { buscarDinheiroLivre } from "../buscar-dinheiro-livre";
import { buscarResumo } from "../buscar-resumo";
import { CartoesDeContadores } from "../contadores";
import {
  PERIODOS_DE_CICLO,
  datasDoCiclo,
  enderecoDoFiltro,
  filtroDaApi,
  intervaloDoPeriodo,
  lerFiltroDaBarra,
  temFiltroDeGasto,
} from "../filtro-da-barra";
import { dataDeHoje } from "../hoje";
import { BlocoIndisponivel, FaixaDeFalha, FalhaTotal } from "../indisponivel";
import { CicloContraAnterior, GastoPorConta } from "./comparativo";
import { GraficoGastoDiario } from "./grafico-gasto-diario";
import { Lista } from "./lista";
import { redirect } from "next/navigation";
import { AbasDeMovimentos } from "./abas";
import { lerPagadores, nomeDoCiclo } from "../pagadores";

function umParametro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function paginaValida(valor: string | undefined): number {
  const pagina = Number(valor);
  return Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
}

/** `null` quando a API falhou: ciclo sem dado não é ciclo sem gasto. */
async function somaDoCiclo(
  ciclo: Ciclo,
  filtro: FiltroDaApi,
): Promise<number | null> {
  const gastos = await buscarGastosDiarios(
    ciclo.inicio,
    ciclo.fim,
    undefined,
    filtro,
  );
  return gastos === null
    ? null
    : gastos.reduce((soma, gasto) => soma + gasto.total, 0);
}

export default async function Movimentos(props: PageProps<"/movimentos">) {
  const parametros = await props.searchParams;
  // Os endereços antigos da fila e da tag continuam funcionando.
  if (umParametro(parametros.classificar)) {
    redirect("/movimentos/classificar");
  }
  if (umParametro(parametros.tag)) {
    redirect(`/movimentos/tags?tag=${umParametro(parametros.tag)}`);
  }
  const filtro = lerFiltroDaBarra(parametros);
  const daApi = filtroDaApi(filtro);
  const pagina = paginaValida(umParametro(parametros.pagina));
  const limite = 50;

  const [ciclos, resumo] = await Promise.all([
    buscarCiclos(filtro.referencia ?? dataDeHoje()),
    buscarResumo(),
  ]);

  if (ciclos === null) {
    return (
      <>
        <header className="flex flex-col gap-[3px]">
          <h1 className="text-[23px] font-bold tracking-[-0.2px]">
            Movimentos
          </h1>
        </header>
        <AbasDeMovimentos paraClassificar={null} />
        <FalhaTotal />
      </>
    );
  }

  const hoje = dataDeHoje();
  const pagadores = lerPagadores();
  const periodo = intervaloDoPeriodo(filtro, ciclos, hoje, (numero) => nomeDoCiclo(numero, pagadores));
  const anterior = periodo.cicloAnterior;
  // A cota é a do dinheiro livre de hoje, que soma todas as contas: só vale
  // para o ciclo de hoje e sem filtro de conta, categoria ou tag.
  const noCicloDeHoje =
    periodo.ciclo !== null && periodo.inicio <= hoje && hoje <= periodo.fim;
  const comCota = noCicloDeHoje && !temFiltroDeGasto(filtro);
  const [
    gastos,
    fluxos,
    movimentos,
    somaAnterior,
    categorias,
    paraClassificar,
    tags,
    dinheiro,
    naoUteis,
  ] = await Promise.all([
    buscarGastosDiarios(periodo.inicio, periodo.fim, undefined, daApi),
    buscarFluxoPorConta(periodo.inicio, periodo.fim, daApi),
    buscarMovimentos(
      periodo.inicio,
      periodo.fim,
      undefined,
      limite,
      (pagina - 1) * limite,
      false,
      undefined,
      undefined,
      daApi,
    ),
    anterior ? somaDoCiclo(anterior, daApi) : Promise.resolve(null),
    buscarCategorias(),
    buscarParaClassificar(hoje),
    buscarTags(),
    comCota ? buscarDinheiroLivre(hoje) : Promise.resolve(null),
    buscarDiasNaoUteis(periodo.inicio, periodo.fim),
  ]);
  const cota =
    dinheiro && dinheiro.ciclo.inicio === periodo.inicio
      ? dinheiro.cotaDoDia
      : null;
  // Com o livre negativo, a cota também é: "dentro da cota" não teria sentido.
  const contadores = await buscarContadores(
    periodo.inicio,
    periodo.fim,
    hoje,
    cota !== null && cota > 0 ? cota : null,
    daApi,
    false,
  );

  const somaAtual =
    gastos?.reduce((soma, gasto) => soma + gasto.total, 0) ?? null;
  const totalEmRevisao =
    gastos?.reduce((soma, gasto) => soma + gasto.emRevisao, 0) ?? 0;
  const contas = resumo?.contas ?? [];
  const fluxosVisiveis =
    fluxos && filtro.contas.length > 0
      ? fluxos.filter((fluxo) => filtro.contas.includes(fluxo.contaId))
      : fluxos;
  const comparativoFalhou =
    anterior !== null && (somaAtual === null || somaAnterior === null);

  const falhas = [
    gastos === null && "gasto por dia",
    contadores === null && "contadores",
    comparativoFalhou && "comparativo com o ciclo anterior",
    fluxos === null && "gasto por conta",
    movimentos === null && "lista de movimentos",
    resumo === null && "nomes das contas",
    categorias === null && "categorias",
  ].filter((parte): parte is string => typeof parte === "string");

  const tituloDoGrafico = `Gasto por dia: ${periodo.rotulo}`;
  const gastoPorConta =
    fluxosVisiveis === null ? (
      <BlocoIndisponivel
        titulo="Gasto por conta no período"
        rotulo="Gasto por conta no período"
      />
    ) : (
      <GastoPorConta fluxos={fluxosVisiveis} />
    );

  return (
    <>
      <header className="flex flex-col gap-[3px]">
        <h1 className="text-[23px] font-bold tracking-[-0.2px]">Movimentos</h1>
        <span className="text-tinta-3 text-[13px]">
          O gráfico e os indicadores cobrem {periodo.rotulo}.
        </span>
      </header>

      <AbasDeMovimentos paraClassificar={paraClassificar} />

      <FaixaDeFalha partes={falhas} />

      <BarraDeFiltros
        caminho="/movimentos"
        filtro={filtro}
        rotuloDoPeriodo={periodo.rotulo}
        hoje={hoje}
        opcoes={{
          ciclos: PERIODOS_DE_CICLO.map((chave) => ({
            periodo: chave,
            rotulo: nomeDoCiclo(ciclos[chave].numero, pagadores),
            datas: datasDoCiclo(ciclos[chave]),
          })),
          contas: contas.map((conta) => ({
            id: conta.id,
            nome: conta.nome,
            apelido: conta.apelido,
            bancoDaConexao: conta.bancoDaConexao,
            tipo: conta.tipo,
            final: conta.final,
          })),
          categorias: (categorias ?? []).map((categoria) => ({
            id: categoria.id,
            nome: categoria.nome,
            icone: categoria.icone,
            cor: categoria.cor,
          })),
          tags: (tags ?? []).map((tag) => ({ id: tag.id, nome: tag.nome, icone: tag.icone, cor: tag.cor })),
        }}
      />

      {contadores && (
        <CartoesDeContadores
          contadores={contadores}
          cotaNegativa={cota !== null && cota <= 0}
          nomeDoCicloComparado={
            contadores.cicloComparado
              ? nomeDoCiclo(contadores.cicloComparado.numero, lerPagadores())
              : null
          }
          categorias={categorias ?? []}
        />
      )}

      {totalEmRevisao > 0 && (
        <p
          role="status"
          className="bg-gasto-fundo text-gasto rounded-xl px-4 py-3 text-[13px]"
        >
          O total inclui{" "}
          {totalEmRevisao.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}{" "}
          em possíveis duplicidades aguardando revisão.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.6fr_1fr]">
        {gastos === null ? (
          <BlocoIndisponivel titulo={tituloDoGrafico} rotulo="Gasto por dia" />
        ) : (
          <GraficoGastoDiario
            gastos={gastos}
            inicio={periodo.inicio}
            fim={periodo.fim}
            cota={cota ?? contadores?.cota ?? null}
            hoje={noCicloDeHoje || periodo.ciclo === null ? hoje : null}
            titulo={tituloDoGrafico}
            naoUteis={naoUteis ?? []}
          />
        )}
        {!anterior || !periodo.ciclo ? (
          gastoPorConta
        ) : somaAtual === null || somaAnterior === null ? (
          <BlocoIndisponivel
            titulo={`Ciclo ${periodo.ciclo.numero} vs ciclo anterior`}
            rotulo="Comparativo com o ciclo anterior"
          />
        ) : (
          <CicloContraAnterior
            atual={somaAtual}
            anterior={somaAnterior}
            numero={periodo.ciclo.numero}
          />
        )}
      </div>

      {anterior && periodo.ciclo && gastoPorConta}

      {movimentos === null ? (
        <BlocoIndisponivel titulo="Movimentos" rotulo="Movimentos" />
      ) : (
        <Lista
          movimentos={movimentos}
          contas={contas}
          categorias={categorias}
          tagsExistentes={(tags ?? []).map((tag) => tag.nome)}
          tags={tags ?? []}
        />
      )}

      <nav
        aria-label="Paginação dos movimentos"
        className="flex justify-end gap-2"
      >
        {pagina > 1 && (
          <Link
            className="border-borda bg-superficie rounded-lg border px-3 py-2 text-[13px]"
            href={enderecoDoFiltro("/movimentos", filtro, {
              pagina: pagina - 1,
            })}
          >
            Página anterior
          </Link>
        )}
        {(movimentos?.length ?? 0) === limite && (
          <Link
            className="border-borda bg-superficie rounded-lg border px-3 py-2 text-[13px]"
            href={enderecoDoFiltro("/movimentos", filtro, {
              pagina: pagina + 1,
            })}
          >
            Próxima página
          </Link>
        )}
      </nav>
    </>
  );
}
