import Link from "next/link";
import type { ContaFixa, DinheiroLivre } from "../buscar-dinheiro-livre";
import { comoData, diaEMes, moeda } from "../formato";
import { Info } from "../info";

const PROXIMAS_VISIVEIS = 3;
const DIA_DA_SEMANA = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

type Parte = { rotulo: string; valor: number; cor: string; dica: string; semValor?: string };

function LinhaDaContaFixa({ conta }: { conta: ContaFixa }) {
  const data = comoData(conta.dataPrevista);
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 text-[13.5px]">
      <span className="bg-fixa-fundo text-fixa w-[42px] rounded-lg py-1 text-center text-[13px] leading-tight font-semibold">
        {DIA_DA_SEMANA.format(data).replace(".", "")}
        <b className="block text-[15px]">{data.getDate()}</b>
      </span>
      <span className="min-w-0">
        <span className="block truncate">{conta.nome}</span>
        <small className={`block text-[13px] ${conta.atrasada ? "text-alerta font-semibold" : "text-tinta-3"}`}>
          {conta.atrasada
            ? `atrasada, prevista para ${diaEMes(conta.dataPrevista)}`
            : conta.origem === "recorrencia"
              ? "recorrência aprovada"
              : "compromisso"}
        </small>
      </span>
      <span className="num text-fixa font-semibold">{moeda(conta.valor)}</span>
    </li>
  );
}

/** Para onde vai o saldo das contas, e as contas fixas que ainda vão sair. */
export function ComposicaoDoSaldo({
  dinheiro,
  temCartao,
}: {
  dinheiro: DinheiroLivre;
  temCartao: boolean;
}) {
  const fim = diaEMes(dinheiro.ciclo.fim);
  const partes: Parte[] = [
    {
      rotulo: "Cartão usado",
      valor: dinheiro.cartaoUsado,
      cor: "bg-alerta-forte",
      dica: "Total usado nos cartões. Sai do livre desde a compra.",
      semValor: temCartao ? undefined : "sem cartão conectado",
    },
    {
      rotulo: "Contas fixas",
      valor: dinheiro.contasFixasTotal,
      cor: "bg-fixa",
      dica: "Recorrências aprovadas e compromissos que vencem antes do pagamento e ainda não foram pagos.",
    },
    {
      rotulo: "Caixinha",
      valor: dinheiro.caixinha,
      cor: "bg-caixinha",
      dica: "Aporte deste ciclo para a sua meta de reserva.",
    },
    {
      rotulo: `Livre até ${fim}`,
      valor: dinheiro.livre,
      cor: "bg-positivo-forte",
      dica: "Saldo menos cartão, contas fixas e caixinha.",
    },
  ];
  // Livre negativo não ocupa espaço na barra: a barra mostra o que o saldo
  // cobre, e o valor negativo aparece na legenda.
  const total = partes.reduce((soma, parte) => soma + Math.max(parte.valor, 0), 0);
  const visiveis = dinheiro.contasFixas.slice(0, PROXIMAS_VISIVEIS);
  const escondidas = dinheiro.contasFixas.slice(PROXIMAS_VISIVEIS);

  return (
    <section
      aria-label="Saldo nas contas"
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border p-4"
    >
      <div className="flex items-center gap-1">
        <h2 className="text-sm font-bold">
          Saldo nas contas: <span className="num">{moeda(dinheiro.saldoContas)}</span>
        </h2>
        <Info sobre="saldo nas contas" texto="Soma dos saldos das contas correntes na última sincronização." />
      </div>

      {total > 0 && (
        <div aria-hidden className="flex h-3.5 gap-0.5">
          {partes
            .filter((parte) => parte.valor > 0)
            .map((parte) => (
              <span
                key={parte.rotulo}
                style={{ width: `${(parte.valor / total) * 100}%` }}
                className={`${parte.cor} h-full rounded`}
              />
            ))}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3.5 gap-y-2.5 lg:grid-cols-4">
        {partes.map((parte) => (
          <div key={parte.rotulo} className="flex flex-col gap-0.5">
            <dt className="text-tinta-2 flex items-center gap-1 text-[13px]">
              <i aria-hidden className={`${parte.cor} inline-block size-[11px] rounded-[3px]`} />
              {parte.rotulo}
              <Info sobre={parte.rotulo.toLowerCase()} texto={parte.dica} />
            </dt>
            <dd className={`num text-[15px] font-semibold ${parte.valor < 0 ? "text-alerta" : ""}`}>
              {parte.semValor ?? (parte.valor < 0 ? `- ${moeda(-parte.valor)}` : moeda(parte.valor))}
            </dd>
          </div>
        ))}
      </dl>

      <div className="border-borda-sutil flex flex-col gap-2 border-t pt-3">
        <h3 className="text-sm font-bold">
          Contas fixas até o pagamento
        </h3>
        {visiveis.length === 0 ? (
          <p className="text-tinta-3 text-[13px]">
            Nenhuma prevista até {fim}.{" "}
            <Link href="/recorrencias" className="text-marca font-semibold hover:underline">
              Aprovar recorrências
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visiveis.map((conta) => (
              <LinhaDaContaFixa key={`${conta.nome}-${conta.dataPrevista}`} conta={conta} />
            ))}
          </ul>
        )}
        {escondidas.length > 0 && (
          <p className="text-tinta-2 text-[13px]">
            + {escondidas.length} {escondidas.length === 1 ? "conta" : "contas"} somando{" "}
            <span className="num">{moeda(escondidas.reduce((soma, conta) => soma + conta.valor, 0))}</span>
          </p>
        )}
      </div>
    </section>
  );
}
