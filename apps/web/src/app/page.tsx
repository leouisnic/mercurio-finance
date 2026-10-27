import { BotaoSincronizar } from "./botao-sincronizar";
import { buscarDinheiroLivre } from "./buscar-dinheiro-livre";
import { buscarFluxoPorConta } from "./buscar-movimentos";
import { buscarResumo } from "./buscar-resumo";
import { comoData, tempoDesde } from "./formato";
import { dataDeHoje } from "./hoje";
import { BlocoIndisponivel, FaixaDeFalha, FalhaTotal } from "./indisponivel";
import { ComposicaoDoSaldo } from "./inicio/composicao-do-saldo";
import { GraficoDoCiclo } from "./inicio/grafico-do-ciclo";
import { HojeDaParaGastar } from "./inicio/hoje-da-para-gastar";
import { LinhaDoTempo } from "./inicio/linha-do-tempo";
import { lerPagadores } from "./pagadores";
import { ResumoPainel } from "./resumo-painel";

/** Verde até 15 min, laranja até 4 h, vermelho acima: o quanto o dado da
 *  tela ainda merece confiança. */
function tomDaSincronizacao(atualizadoEm: string, agora: Date) {
  const minutos = (agora.getTime() - new Date(atualizadoEm).getTime()) / 60000;
  if (minutos <= 15) {
    return "bg-positivo-fundo text-positivo";
  }
  return minutos <= 240 ? "bg-gasto-fundo text-gasto" : "bg-alerta-fundo text-alerta";
}

export default async function Inicio() {
  const agora = new Date();
  const hoje = dataDeHoje();
  const pagadores = lerPagadores();
  const [resumo, dinheiro] = await Promise.all([buscarResumo(), buscarDinheiroLivre(hoje)]);
  const fluxos = dinheiro ? await buscarFluxoPorConta(dinheiro.ciclo.inicio, dinheiro.ciclo.fim) : null;

  const falhas = [
    dinheiro === null && "dinheiro livre e gasto por dia",
    resumo === null && "contas conectadas",
    dinheiro !== null && resumo !== null && fluxos === null && "entradas e saídas do ciclo",
  ].filter((parte): parte is string => typeof parte === "string");

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.2px]">Início</h1>
        <div className="flex items-start gap-2.5">
          {resumo?.atualizadoEm && (
            <span
              className={`${tomDaSincronizacao(resumo.atualizadoEm, agora)} rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold`}
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
                  temCartao={resumo === null || resumo.contas.some((conta) => conta.tipo === "CREDIT")}
                />
              </div>
              <GraficoDoCiclo
                inicio={dinheiro.ciclo.inicio}
                fim={dinheiro.ciclo.fim}
                hoje={hoje}
                cota={dinheiro.cotaDoDia}
                gastos={dinheiro.gastosPorDia}
              />
            </>
          ) : (
            <BlocoIndisponivel titulo="Hoje dá para gastar" rotulo="Hoje dá para gastar" />
          )}

          {resumo ? (
            <ResumoPainel contas={resumo.contas} fluxos={fluxos} hoje={comoData(hoje)} />
          ) : (
            <BlocoIndisponivel titulo="Contas conectadas" rotulo="Contas conectadas" />
          )}
        </>
      )}
    </>
  );
}
