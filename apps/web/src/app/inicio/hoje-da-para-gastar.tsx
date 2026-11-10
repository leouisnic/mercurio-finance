import {
  CalendarClock,
  CalendarDays,
  CircleAlert,
  PiggyBank,
  TrendingUp,
  Vault,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import type { DinheiroLivre } from "../buscar-dinheiro-livre";
import { comSinal, comoData, diaEMes, diasEntre, moeda } from "../formato";
import { Info } from "../info";

function Quadro({
  icone,
  fundoDoIcone,
  rotulo,
  info,
  valor,
  corDoValor = "",
  aoLado,
}: {
  icone: ReactNode;
  fundoDoIcone: string;
  rotulo: string;
  info?: { sobre: string; texto: string };
  valor: string;
  corDoValor?: string;
  aoLado?: string;
}) {
  return (
    <div className="bg-superficie-2 border-borda-sutil flex items-center gap-3 rounded-xl border p-3">
      <span
        className={`${fundoDoIcone} grid size-[30px] shrink-0 place-items-center rounded-[9px]`}
      >
        {icone}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-tinta-2 flex items-center gap-1 text-[13px] whitespace-nowrap">
          {rotulo}
          {info && <Info sobre={info.sobre} texto={info.texto} />}
        </span>
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <b className={`num text-base ${corDoValor}`}>{valor}</b>
          {aoLado && (
            <span className="text-tinta-3 text-xs font-semibold">
              {aoLado}
            </span>
          )}
        </span>
      </span>
    </div>
  );
}

/**
 * O número que a tela inicial responde primeiro: quanto dá para gastar hoje.
 * O cartão tem a mesma altura em todos os casos, pela decisão visual da spec
 * do dinheiro livre e do plano do ciclo: o que muda é o conteúdo dos quadros,
 * nunca a quantidade deles.
 */
export function HojeDaParaGastar({ dinheiro }: { dinheiro: DinheiroLivre }) {
  const {
    hojeDisponivel,
    gastoHoje,
    cotaDoDia,
    cofrinho,
    livre,
    faltaParaFechar,
    guardadoNoCiclo,
    guardadoEm,
    daParaGuardar,
  } = dinheiro;
  const acabou = livre < 0;
  const podiaHoje = gastoHoje + hojeDisponivel;
  const usado = acabou
    ? 100
    : podiaHoje > 0
      ? Math.min(100, (gastoHoje / podiaHoje) * 100)
      : 100;
  const vermelho = acabou || hojeDisponivel < 0;
  const proximoPagamento = dinheiro.cicloSeguinte.inicio;
  const diasAtePagamento = diasEntre(
    comoData(dinheiro.hoje),
    comoData(proximoPagamento),
  );

  return (
    <section
      aria-label="Hoje dá para gastar"
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border p-4"
    >
      <div className="flex items-center gap-2">
        <span className="bg-positivo-fundo text-positivo grid size-[30px] place-items-center rounded-[9px]">
          <Wallet size={18} aria-hidden />
        </span>
        <h2 className="text-sm font-bold">Hoje dá para gastar</h2>
        <Info
          sobre="hoje dá para gastar"
          texto="Cota de hoje mais o cofrinho, menos o já gasto hoje."
        />
      </div>

      <span
        className={`text-[36px] leading-none font-bold tracking-[-0.8px] sm:text-[40px] ${vermelho ? "text-alerta" : "text-positivo"}`}
      >
        {acabou
          ? moeda(0)
          : hojeDisponivel < 0
            ? `- ${moeda(-hojeDisponivel)}`
            : moeda(hojeDisponivel)}
      </span>

      <div className="flex flex-col gap-1.5">
        <div
          role="meter"
          aria-label="Gasto de hoje"
          aria-valuenow={Math.round(usado)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="bg-marca-clara h-2 overflow-hidden rounded-full"
        >
          <div
            style={{ width: `${Math.max(usado, 2)}%` }}
            className={`h-full rounded-full ${vermelho ? "bg-alerta-forte" : "bg-marca"}`}
          />
        </div>
        <div className="text-tinta-2 flex justify-between text-[13px]">
          <span>Gasto hoje {moeda(gastoHoje)}</span>
          <span>De {moeda(acabou ? 0 : Math.max(podiaHoje, 0))}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {acabou ? (
          <>
            <Quadro
              icone={<CircleAlert size={18} strokeWidth={2} aria-hidden />}
              fundoDoIcone="bg-alerta-fundo text-alerta"
              rotulo="Falta para fechar"
              info={{
                sobre: "falta para fechar",
                texto:
                  "O que falta para o saldo cobrir o cartão e as contas fixas até o próximo pagamento. Cota e cofrinho voltam quando sobrar.",
              }}
              valor={moeda(faltaParaFechar)}
              corDoValor="text-alerta"
            />
            <Quadro
              icone={<CalendarClock size={18} strokeWidth={2} aria-hidden />}
              fundoDoIcone="bg-borda-sutil text-tinta-2"
              rotulo="Próximo pagamento"
              valor={diaEMes(proximoPagamento)}
              aoLado={
                diasAtePagamento === 1 ? "Amanhã" : `Em ${diasAtePagamento} dias`
              }
            />
          </>
        ) : (
          <>
            <Quadro
              icone={<CalendarDays size={18} strokeWidth={2} aria-hidden />}
              fundoDoIcone="bg-borda-sutil text-tinta-2"
              rotulo="Cota do dia"
              info={{
                sobre: "cota do dia",
                texto: "O livre dividido pelos dias do ciclo.",
              }}
              valor={moeda(cotaDoDia)}
            />
            <Quadro
              icone={<PiggyBank size={18} strokeWidth={2} aria-hidden />}
              fundoDoIcone="bg-caixinha-fundo text-caixinha-texto"
              rotulo="Cofrinho"
              info={{
                sobre: "cofrinho",
                texto: "Sobra ou falta dos dias anteriores do ciclo.",
              }}
              valor={comSinal(cofrinho)}
              corDoValor={cofrinho < 0 ? "text-alerta" : "text-caixinha-texto"}
            />
          </>
        )}
        <Quadro
          icone={<Vault size={18} strokeWidth={2} aria-hidden />}
          fundoDoIcone="bg-guardado-fundo text-guardado"
          rotulo="Guardado no ciclo"
          info={{
            sobre: "guardado no ciclo",
            texto:
              "O que você aplicou no banco neste ciclo, menos o que resgatou. Sai da cota só do dia da aplicação em diante.",
          }}
          // Resgate de dinheiro guardado em outro ciclo deixa o líquido
          // negativo; para quem lê, nada foi guardado neste ciclo.
          valor={moeda(Math.max(guardadoNoCiclo, 0))}
          corDoValor="text-guardado"
          aoLado={guardadoEm ? diaEMes(guardadoEm) : undefined}
        />
        <Quadro
          icone={<TrendingUp size={18} strokeWidth={2} aria-hidden />}
          fundoDoIcone="bg-positivo-fundo text-positivo"
          rotulo="Dá para guardar"
          info={{
            sobre: "dá para guardar",
            texto:
              daParaGuardar === null
                ? "Precisa de pelo menos dois ciclos completos de histórico para saber quanto seu dia a dia costuma custar."
                : "Quanto sobra no ciclo depois do seu dia a dia de costume. É só sugestão.",
          }}
          valor={daParaGuardar === null ? "Sem histórico" : moeda(daParaGuardar)}
          corDoValor={daParaGuardar === null ? "text-tinta-3" : ""}
        />
      </div>
    </section>
  );
}
