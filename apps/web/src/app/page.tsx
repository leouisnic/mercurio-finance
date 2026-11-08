import { BarraDeFiltros } from "./barra-de-filtros";
import { BotaoSincronizar } from "./botao-sincronizar";
import { buscarDinheiroLivre } from "./buscar-dinheiro-livre";
import { buscarDiasNaoUteis } from "./buscar-feriados";
import {
  buscarCategorias,
  buscarCiclos,
  buscarContadores,
  buscarFluxoPorConta,
  buscarGastosDiarios,
  buscarParaClassificar,
  buscarTags,
} from "./buscar-movimentos";
import { buscarResumo } from "./buscar-resumo";
import { CartoesDeContadores } from "./contadores";
import {
  PERIODOS_DE_CICLO,
  datasDoCiclo,
  filtroDaApi,
  intervaloDoPeriodo,
  lerFiltroDaBarra,
  temFiltroDeGasto,
} from "./filtro-da-barra";
import { comoData, tempoDesde } from "./formato";
import { dataDeHoje } from "./hoje";
import Link from "next/link";
import { BlocoIndisponivel, FaixaDeFalha, FalhaTotal } from "./indisponivel";
import { ComposicaoDoSaldo } from "./inicio/composicao-do-saldo";
import { GraficoDoCiclo } from "./inicio/grafico-do-ciclo";
import { HojeDaParaGastar } from "./inicio/hoje-da-para-gastar";
import { LinhaDoTempo } from "./inicio/linha-do-tempo";
import { lerPagadores, nomeDoCiclo } from "./pagadores";
import { ResumoPainel } from "./resumo-painel";

/** Verde até 15 min, laranja até 4 h, vermelho acima: o quanto o dado da
 *  tela ainda merece confiança. */
function tomDaSincronizacao(atualizadoEm: string, agora: Date) {
  const minutos = (agora.getTime() - new Date(atualizadoEm).getTime()) / 60000;
  if (minutos <= 15) {
    return "bg-positivo-fundo text-positivo";
  }
  return minutos <= 240
    ? "bg-gasto-fundo text-gasto"
    : "bg-alerta-fundo text-alerta";
}

export default async function Inicio(props: PageProps<"/">) {
  const agora = new Date();
  const hoje = dataDeHoje();
  const pagadores = lerPagadores();
  // Os filtros mudam só a análise (contadores e gráfico): "Hoje dá para
  // gastar", a cota e o saldo são sempre do ciclo de hoje e de todas as contas.
  const filtro = lerFiltroDaBarra(await props.searchParams);
  const daApi = filtroDaApi(filtro);
  const [resumo, dinheiro, paraClassificar, ciclos, categorias, tags] =
    await Promise.all([
      buscarResumo(),
      buscarDinheiroLivre(hoje),
      buscarParaClassificar(hoje),
      buscarCiclos(filtro.referencia ?? hoje),
      buscarCategorias(),
      buscarTags(),
    ]);
  const fluxos = dinheiro
    ? await buscarFluxoPorConta(dinheiro.ciclo.inicio, dinheiro.ciclo.fim)
    : null;
  const periodo = ciclos
    ? intervaloDoPeriodo(filtro, ciclos, hoje, (numero) => nomeDoCiclo(numero, pagadores))
    : null;
  const semFiltro =
    !temFiltroDeGasto(filtro) &&
    periodo !== null &&
    periodo.inicio === dinheiro?.ciclo.inicio &&
    periodo.fim === dinheiro?.ciclo.fim;
  const cota = semFiltro && dinheiro ? dinheiro.cotaDoDia : null;
  // Com o livre negativo, a cota também é: "dentro da cota" não teria sentido.
  const cotaDosContadores = cota !== null && cota > 0 ? cota : null;
  const [gastosFiltrados, contadores, naoUteis] = periodo
    ? await Promise.all([
        semFiltro
          ? Promise.resolve(null)
          : buscarGastosDiarios(
              periodo.inicio,
              periodo.fim,
              undefined,
              daApi,
              true,
            ),
        buscarContadores(
          periodo.inicio,
          periodo.fim,
          hoje,
          cotaDosContadores,
          daApi,
          true,
        ),
        buscarDiasNaoUteis(periodo.inicio, periodo.fim),
      ])
    : [null, null, null];

  const falhas = [
    dinheiro === null && "dinheiro livre e gasto por dia",
    resumo === null && "contas conectadas",
    dinheiro !== null &&
      resumo !== null &&
      fluxos === null &&
      "entradas e saídas do ciclo",
    dinheiro !== null &&
      paraClassificar === null &&
      "movimentos para classificar",
    periodo !== null && contadores === null && "contadores",
    !semFiltro &&
      periodo !== null &&
      gastosFiltrados === null &&
      "gasto por dia com o filtro",
  ].filter((parte): parte is string => typeof parte === "string");

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.2px]">Início</h1>
        <div className="flex items-center gap-2.5">
          {resumo?.atualizadoEm && (
            <span
              className={`${tomDaSincronizacao(resumo.atualizadoEm, agora)} inline-flex h-10 items-center rounded-[10px] px-3.5 text-[13px] font-semibold whitespace-nowrap`}
            >
              Sincronizado {tempoDesde(resumo.atualizadoEm, agora)}
            </span>
          )}
          <BotaoSincronizar />
        </div>
      </header>

      {dinheiro === null && resumo === null ? (
        <FalhaTotal />
      ) : (
        <>
          <FaixaDeFalha partes={falhas} />

          {(paraClassificar ?? 0) > 0 && (
            <div className="bg-aviso-fundo border-aviso-borda text-aviso flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[13.5px] font-semibold">
              <span>
                {paraClassificar === 1
                  ? "1 movimento"
                  : `${paraClassificar} movimentos`}{" "}
                para classificar
              </span>
              <Link
                href="/movimentos/classificar"
                className="rounded-md px-1 underline hover:bg-aviso-borda/40"
              >
                Classificar
              </Link>
            </div>
          )}

          {dinheiro ? (
            <>
              <LinhaDoTempo
                hoje={hoje}
                ciclo={dinheiro.ciclo}
                cicloSeguinte={dinheiro.cicloSeguinte}
                pagadores={pagadores}
              />
              <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1fr_1.25fr]">
                <HojeDaParaGastar dinheiro={dinheiro} />
                <ComposicaoDoSaldo
                  dinheiro={dinheiro}
                  temCartao={
                    resumo === null ||
                    resumo.contas.some((conta) => conta.tipo === "CREDIT")
                  }
                />
              </div>
              {ciclos && periodo && (
                <BarraDeFiltros
                  caminho="/"
                  filtro={filtro}
                  rotuloDoPeriodo={periodo.rotulo}
                  hoje={hoje}
                  opcoes={{
                    ciclos: PERIODOS_DE_CICLO.map((chave) => ({
                      periodo: chave,
                      rotulo: nomeDoCiclo(ciclos[chave].numero, pagadores),
                      datas: datasDoCiclo(ciclos[chave]),
                    })),
                    contas: (resumo?.contas ?? []).map((conta) => ({
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
                    tags: (tags ?? []).map((tag) => ({
                      id: tag.id,
                      nome: tag.nome,
                      icone: tag.icone,
                      cor: tag.cor,
                    })),
                  }}
                />
              )}
              {contadores && (
                <CartoesDeContadores
                  contadores={contadores}
                  cotaNegativa={cota !== null && cota <= 0}
                  nomeDoCicloComparado={
                    contadores.cicloComparado
                      ? nomeDoCiclo(
                          contadores.cicloComparado.numero,
                          lerPagadores(),
                        )
                      : null
                  }
                  categorias={categorias ?? []}
                />
              )}
              {semFiltro || !periodo ? (
                <GraficoDoCiclo
                  inicio={dinheiro.ciclo.inicio}
                  fim={dinheiro.ciclo.fim}
                  hoje={hoje}
                  cota={dinheiro.cotaDoDia}
                  gastos={dinheiro.gastosPorDia}
                  naoUteis={naoUteis ?? []}
                />
              ) : gastosFiltrados === null ? (
                <BlocoIndisponivel
                  titulo="Gasto por dia"
                  rotulo="Gasto por dia e cota"
                />
              ) : (
                <GraficoDoCiclo
                  inicio={periodo.inicio}
                  fim={periodo.fim}
                  hoje={hoje}
                  cota={contadores?.cota ?? null}
                  gastos={gastosFiltrados}
                  naoUteis={naoUteis ?? []}
                />
              )}
            </>
          ) : (
            <BlocoIndisponivel
              titulo="Hoje dá para gastar"
              rotulo="Hoje dá para gastar"
            />
          )}

          {resumo ? (
            <ResumoPainel
              contas={resumo.contas}
              fluxos={fluxos}
              hoje={comoData(hoje)}
            />
          ) : (
            <BlocoIndisponivel
              titulo="Contas conectadas"
              rotulo="Contas conectadas"
            />
          )}
        </>
      )}
    </>
  );
}
