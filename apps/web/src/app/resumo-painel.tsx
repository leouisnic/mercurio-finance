import Image from "next/image";
import { nomeDaConta } from "./banco";
import { CabecalhoDaConta } from "./cabecalho-da-conta";
import type { Conta } from "./buscar-resumo";
import type { FluxoDaConta } from "./buscar-movimentos";
import { comoData, diasEntre, diaEMes, moeda } from "./formato";
import { Info } from "./info";

/** Verde até 60% do limite, laranja até 85%, vermelho acima. */
function corDoUso(percentual: number): { barra: string; texto: string; trilho: string } {
  if (percentual > 85) {
    return { barra: "bg-alerta-forte", texto: "text-alerta", trilho: "bg-alerta-fundo" };
  }
  if (percentual > 60) {
    return { barra: "bg-gasto-forte", texto: "text-gasto", trilho: "bg-gasto-fundo" };
  }
  return { barra: "bg-positivo-forte", texto: "text-positivo", trilho: "bg-positivo-fundo" };
}

const BANDEIRAS: { padrao: RegExp; nome: string; logo: string; largura: number }[] = [
  { padrao: /visa/i, nome: "Visa", logo: "/bandeiras/visa.svg", largura: 44 },
  { padrao: /master/i, nome: "Mastercard", logo: "/bandeiras/mastercard.svg", largura: 40 },
];

function Bandeira({ bandeira }: { bandeira: string | null }) {
  if (!bandeira) {
    return null;
  }
  const conhecida = BANDEIRAS.find(({ padrao }) => padrao.test(bandeira));
  return conhecida ? (
    <Image src={conhecida.logo} alt={conhecida.nome} width={conhecida.largura} height={26} unoptimized />
  ) : (
    <span className="text-tinta-2 text-[13px] font-bold">{bandeira}</span>
  );
}

const CARTAO = "bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border p-4";
const ROTULO_DA_BARRA = "mt-2 flex justify-between gap-3 text-sm font-semibold";

function comSinal(valor: number): string {
  return valor < 0 ? `- ${moeda(-valor)}` : `+ ${moeda(valor)}`;
}

function Caixa({ rotulo, valor, cor, dica }: { rotulo: string; valor: string; cor?: string; dica?: string }) {
  return (
    <div className="bg-superficie-2 border-borda-sutil flex flex-col gap-0.5 rounded-xl border px-3 py-2.5">
      <span className="text-tinta-2 flex items-center gap-1 text-[13px]">
        {rotulo}
        {dica && <Info sobre={rotulo.toLowerCase()} texto={dica} />}
      </span>
      <b className={`num text-[15px] ${cor ?? ""}`}>{valor}</b>
    </div>
  );
}

/**
 * Entrou e saiu de verdade da conta: além de receita e gasto, a fatura paga
 * e o que foi e veio de outra conta do titular. É o que faz a variação do
 * ciclo bater com a mudança do saldo; só entradas menos gastos dava um
 * "saldo do ciclo" positivo numa conta quase zerada.
 */
function CartaoCorrente({
  conta,
  fluxo,
  fluxoIndisponivel,
}: {
  conta: Conta;
  fluxo: FluxoDaConta | undefined;
  fluxoIndisponivel: boolean;
}) {
  const fatura = fluxo?.faturaPaga ?? 0;
  const veio = fluxo?.transferenciasEntrada ?? 0;
  const foi = fluxo?.transferenciasSaida ?? 0;
  const entrou = (fluxo?.entradas ?? 0) + veio;
  const saiu = (fluxo?.saidas ?? 0) + fatura + foi;
  const composicao = [
    `Gastos ${moeda(fluxo?.saidas ?? 0)}`,
    `fatura do cartão ${moeda(fatura)}`,
    `enviado para outras contas suas ${moeda(foi)}`,
    `recebido de outras contas suas ${moeda(veio)}`,
  ].join(", ");

  return (
    <article className={CARTAO}>
      <CabecalhoDaConta
        conta={conta}
        subtitulo="Conta corrente"
        direita={
          <span className="bg-positivo-fundo text-positivo rounded-full px-3 py-1 text-[13px] font-bold tracking-[0.04em]">
            SALDO
          </span>
        }
      />
      <span className="flex flex-col gap-0.5">
        <span className="num text-positivo text-2xl font-bold tracking-[-0.3px]">{moeda(conta.saldo)}</span>
        <span className="text-tinta-2 text-sm">disponível agora</span>
      </span>
      {fluxoIndisponivel ? (
        <p className="text-tinta-2 mt-auto text-sm">
          Entradas e saídas do ciclo: <b className="text-tinta">Indisponível</b>
        </p>
      ) : (
        <div className="mt-auto grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Caixa rotulo="Entrou" valor={moeda(entrou)} cor="text-positivo" />
          <Caixa rotulo="Saiu" valor={moeda(saiu)} cor="text-gasto" />
          <Caixa
            rotulo="Variação"
            valor={comSinal(entrou - saiu)}
            dica={`Quanto o saldo mudou no ciclo. Saiu: ${composicao}.`}
          />
        </div>
      )}
    </article>
  );
}

/**
 * O que dá para dizer sobre a fatura, sem inventar.
 *
 * A Pluggy manda `balanceCloseDate` nulo e um `balanceDueDate` de um ciclo
 * já encerrado nos bancos conectados hoje, então a data cheia só é exibida
 * quando ainda está no futuro. Vencida, sobra o dia do mês, que continua
 * sendo verdade e é o que importa para o ciclo de pagamento.
 */
function prazoDaFatura(conta: Conta, hoje: Date) {
  const diasAteFechar = conta.fechamento ? diasEntre(hoje, comoData(conta.fechamento)) : null;
  const fechamento =
    diasAteFechar !== null && diasAteFechar >= 0
      ? `fecha em ${diasAteFechar} ${diasAteFechar === 1 ? "dia" : "dias"}`
      : null;

  if (conta.vencimento === null) {
    return { fechamento, vencimento: null };
  }
  const vencimento =
    diasEntre(hoje, comoData(conta.vencimento)) >= 0
      ? `vence ${diaEMes(conta.vencimento)}`
      : `vence dia ${Number(conta.vencimento.slice(8, 10))}`;
  return { fechamento, vencimento };
}

/**
 * "Cartão Gold": o nome cru da Pluggy vira o nome do produto quando o título
 * já mostra o banco (herdado ou do apelido) e o nome é curto. Nome longo ou
 * igual ao título fica só "Cartão de crédito".
 */
export function produtoDoCartao(conta: Conta): string {
  const cru = conta.nome.trim();
  if (nomeDaConta(conta) === cru || cru.length > 20) {
    return "Cartão de crédito";
  }
  return `Cartão ${cru.charAt(0).toUpperCase()}${cru.slice(1)}`;
}

function CartaoCredito({ conta, hoje }: { conta: Conta; hoje: Date }) {
  const percentual = conta.limite ? Math.min(100, (conta.saldo / conta.limite) * 100) : 0;
  const cor = corDoUso(percentual);
  const prazo = prazoDaFatura(conta, hoje);
  const quando = [prazo.fechamento, prazo.vencimento].filter(Boolean).join(" e ");

  return (
    <article className={CARTAO}>
      <CabecalhoDaConta
        conta={conta}
        subtitulo={produtoDoCartao(conta)}
        direita={
          <span className="flex shrink-0 items-center gap-2.5">
            {conta.final && (
              <span className="num text-tinta-2 text-sm font-semibold tracking-wide">
                <span aria-hidden>•••• </span>
                <span className="sr-only">final </span>
                {conta.final}
              </span>
            )}
            <Bandeira bandeira={conta.bandeira} />
          </span>
        }
      />
      <div className="flex items-end justify-between gap-3.5">
        <span className="flex flex-col gap-0.5">
          <span className="num text-gasto text-2xl font-bold tracking-[-0.3px]">{moeda(conta.saldo)}</span>
          <span className="text-tinta-2 text-sm">{quando ? `fatura atual, ${quando}` : "fatura atual"}</span>
        </span>
        {conta.limite !== null && (
          <span className={`${cor.trilho} ${cor.texto} shrink-0 rounded-full px-3 py-1 text-[13px] font-bold`}>
            {Math.round(percentual)}% do limite
          </span>
        )}
      </div>
      {conta.limite !== null && (
        <div className="mt-auto">
          <div
            role="meter"
            aria-label={`Limite usado do ${conta.nome}`}
            aria-valuenow={Math.round(percentual)}
            aria-valuemin={0}
            aria-valuemax={100}
            className={`${cor.trilho} h-2.5 overflow-hidden rounded-full`}
          >
            <div className={`${cor.barra} h-full rounded-full`} style={{ width: `${percentual}%` }} />
          </div>
          <p className={ROTULO_DA_BARRA}>
            <span className="num text-tinta-2">Limite {moeda(conta.limite)}</span>
            {conta.disponivel !== null && <span className="num">{moeda(conta.disponivel)} disponível</span>}
          </p>
        </div>
      )}
    </article>
  );
}

function TituloDaColuna({
  titulo,
  contas,
  cor,
  ordem,
}: {
  titulo: string;
  contas: Conta[];
  cor: string;
  ordem: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${ordem}`}>
      <h2 className="text-tinta-2 text-[13px] font-bold tracking-[0.05em] uppercase">{titulo}</h2>
      {contas.length > 0 && (
        <span className={`num text-base font-bold ${cor}`}>
          {moeda(contas.reduce((soma, conta) => soma + conta.saldo, 0))}
        </span>
      )}
    </div>
  );
}

function ColunaVazia({ texto }: { texto: string }) {
  return (
    <p className="border-borda text-tinta-2 rounded-2xl border border-dashed p-5 text-sm">{texto}</p>
  );
}

/**
 * Contas correntes à esquerda e cartões à direita, numa grade só: cada linha
 * tem uma conta de cada lado, e a grade iguala a altura das duas. No celular,
 * a ordem põe as correntes antes dos cartões.
 */
export function ResumoPainel({
  contas,
  fluxos,
  hoje,
}: {
  contas: Conta[];
  /** `null` quando a API não devolveu o fluxo do ciclo. */
  fluxos: FluxoDaConta[] | null;
  hoje: Date;
}) {
  const porConta = new Map((fluxos ?? []).map((fluxo) => [fluxo.contaId, fluxo]));
  const correntes = contas.filter((conta) => conta.tipo !== "CREDIT");
  const cartoes = contas.filter((conta) => conta.tipo === "CREDIT");
  const linhas = Math.max(correntes.length, cartoes.length, 1);

  return (
    <section aria-label="Contas conectadas" className="grid grid-cols-1 gap-x-4 gap-y-3 lg:grid-cols-2">
      <TituloDaColuna
        titulo="Contas correntes"
        contas={correntes}
        cor="text-positivo"
        ordem="order-1 lg:order-none"
      />
      <TituloDaColuna
        titulo="Cartões de crédito"
        contas={cartoes}
        cor="text-gasto"
        ordem="order-3 lg:order-none"
      />
      {Array.from({ length: linhas }, (_, indice) => {
        const corrente = correntes[indice];
        const cartao = cartoes[indice];
        return [
          <div key={`corrente-${indice}`} className="order-2 flex flex-col lg:order-none [&>article]:flex-1">
            {indice === 0 && !corrente && <ColunaVazia texto="Nenhuma conta corrente conectada" />}
            {corrente && (
              <CartaoCorrente
                conta={corrente}
                fluxo={porConta.get(corrente.id)}
                fluxoIndisponivel={fluxos === null}
              />
            )}
          </div>,
          <div key={`cartao-${indice}`} className="order-4 flex flex-col lg:order-none [&>article]:flex-1">
            {indice === 0 && !cartao && <ColunaVazia texto="Nenhum cartão conectado" />}
            {cartao && <CartaoCredito conta={cartao} hoje={hoje} />}
          </div>,
        ];
      })}
    </section>
  );
}
