import { SeloDoBanco, nomeDaConta } from "./banco";
import type { Conta } from "./buscar-resumo";
import type { FluxoDaConta } from "./buscar-movimentos";
import { comoData, diasEntre, diaEMes, moeda } from "./formato";

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

function Indicador({
  rotulo,
  valor,
  contexto,
  destaque,
}: {
  rotulo: string;
  valor: number;
  contexto: string;
  destaque?: boolean;
}) {
  return (
    <div className="bg-superficie border-borda flex flex-col gap-1.5 rounded-[14px] border px-[18px] py-4">
      <span className="text-tinta-3 text-[11.5px] font-semibold tracking-[0.04em] uppercase">
        {rotulo}
      </span>
      <span
        className={`num text-[21px] font-semibold ${destaque ? "text-gasto-forte" : "text-tinta"}`}
      >
        {moeda(valor)}
      </span>
      <span className="text-tinta-3 text-[11.5px]">{contexto}</span>
    </div>
  );
}

function Selo({ texto, tom }: { texto: string; tom: "saldo" | "fatura" }) {
  const classe =
    tom === "saldo" ? "bg-positivo-fundo text-positivo" : "bg-gasto-fundo text-gasto";
  return (
    <span
      className={`${classe} rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.04em]`}
    >
      {texto}
    </span>
  );
}

function Cabecalho({ conta, tom }: { conta: Conta; tom: "saldo" | "fatura" }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-[11px]">
        <SeloDoBanco nome={conta.nome} />
        <span className="flex min-w-0 flex-col leading-tight">
          {/* Nome longo trunca em vez de quebrar o card em duas linhas: a
              Pluggy devolve coisas como "Nu Pagamentos S.A. - Instituição
              de Pagamento (Conta Pré-paga)". */}
          <span className="truncate text-[14.5px] font-semibold" title={conta.nome}>
            {nomeDaConta(conta.nome)}
          </span>
          <span className="text-tinta-3 text-xs">
            {tom === "saldo" ? "Conta corrente" : "Cartão de crédito"}
          </span>
        </span>
      </div>
      <Selo texto={tom === "saldo" ? "SALDO" : "FATURA"} tom={tom} />
    </div>
  );
}

function CartaoCorrente({ conta, fluxo }: { conta: Conta; fluxo: FluxoDaConta | undefined }) {
  return (
    <article className="bg-superficie border-borda flex flex-col gap-4 rounded-2xl border p-5">
      <Cabecalho conta={conta} tom="saldo" />
      <div className="flex items-end justify-between gap-3.5">
        <span className="flex flex-col gap-0.5">
          <span className="num text-positivo text-[27px] font-semibold tracking-[-0.3px]">
            {moeda(conta.saldo)}
          </span>
          <span className="text-tinta-3 text-xs">disponível para gastar</span>
        </span>
        {fluxo && (
          <span className="flex flex-col items-end gap-[3px]">
            <span className="num text-positivo text-[13px] font-semibold">
              + {moeda(fluxo.entradas)}
            </span>
            <span className="num text-gasto text-xs">- {moeda(fluxo.saidas)}</span>
            <span className="text-tinta-3 text-[10.5px]">entradas/saídas no ciclo</span>
          </span>
        )}
      </div>
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
      ? `Fecha em ${diasAteFechar} ${diasAteFechar === 1 ? "dia" : "dias"}`
      : null;

  if (conta.vencimento === null) {
    return { fechamento, vencimento: null };
  }
  const vencimento =
    diasEntre(hoje, comoData(conta.vencimento)) >= 0
      ? `vence ${diaEMes(conta.vencimento)}`
      : `vence todo dia ${Number(conta.vencimento.slice(8, 10))}`;
  return { fechamento, vencimento };
}

function CartaoCredito({ conta, hoje }: { conta: Conta; hoje: Date }) {
  const percentual = conta.limite ? Math.min(100, (conta.saldo / conta.limite) * 100) : 0;
  const cor = corDoUso(percentual);
  const prazo = prazoDaFatura(conta, hoje);

  return (
    <article className="bg-superficie border-borda flex flex-col gap-4 rounded-2xl border p-5">
      <Cabecalho conta={conta} tom="fatura" />

      <div className="flex items-end justify-between gap-3.5">
        <span className="flex flex-col gap-0.5">
          <span className="num text-gasto text-[27px] font-semibold tracking-[-0.3px]">
            {moeda(conta.saldo)}
          </span>
          <span className="text-tinta-3 text-xs">
            {conta.limite === null ? "sem limite informado" : `de ${moeda(conta.limite)} de limite`}
          </span>
        </span>
        {(prazo.fechamento || prazo.vencimento) && (
          <span className="flex flex-col items-end gap-0.5">
            {prazo.fechamento && (
              <span className={`num text-[13px] font-bold ${cor.texto}`}>{prazo.fechamento}</span>
            )}
            {prazo.vencimento && (
              <span className="text-tinta-3 text-[11.5px]">{prazo.vencimento}</span>
            )}
          </span>
        )}
      </div>

      {conta.limite !== null && (
        <div className="flex flex-col gap-1.5">
          <div
            role="meter"
            aria-label={`Limite usado do ${conta.nome}`}
            aria-valuenow={Math.round(percentual)}
            aria-valuemin={0}
            aria-valuemax={100}
            className={`${cor.trilho} h-2 overflow-hidden rounded-full`}
          >
            <div className={`${cor.barra} h-full rounded-full`} style={{ width: `${percentual}%` }} />
          </div>
          <div className="flex justify-between">
            <span className={`num text-[11px] font-bold ${cor.texto}`}>
              {Math.round(percentual)}% usado
            </span>
            <span className="flex items-center gap-1.5">
              {conta.bandeira && (
                <span className="text-tinta-3 text-[10px] font-bold tracking-wide">
                  {conta.bandeira}
                </span>
              )}
              <span className="num text-tinta-3 text-[11px]">
                {conta.final && `•••• ${conta.final}`}
                {conta.final && conta.disponivel !== null && " · "}
                {conta.disponivel !== null && `${moeda(conta.disponivel)} disp.`}
              </span>
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

export function ResumoPainel({
  contas,
  fluxos,
  hoje,
}: {
  contas: Conta[];
  fluxos: FluxoDaConta[];
  hoje: Date;
}) {
  const correntes = contas.filter((conta) => conta.tipo === "BANK");
  const cartoes = contas.filter((conta) => conta.tipo === "CREDIT");

  const saldoEmConta = correntes.reduce((total, conta) => total + conta.saldo, 0);
  const usadoNoCartao = cartoes.reduce((total, conta) => total + conta.saldo, 0);
  const disponivelNoCartao = cartoes.reduce((total, conta) => total + (conta.disponivel ?? 0), 0);
  const limiteTotal = cartoes.reduce((total, conta) => total + (conta.limite ?? 0), 0);

  const porConta = new Map(fluxos.map((fluxo) => [fluxo.contaId, fluxo]));

  return (
    <>
      <section aria-label="Indicadores" className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Indicador
          rotulo="Saldo em conta"
          valor={saldoEmConta}
          contexto={`${correntes.length} ${correntes.length === 1 ? "conta corrente" : "contas correntes"}`}
        />
        <Indicador
          rotulo="Usado no cartão"
          valor={usadoNoCartao}
          contexto={`${cartoes.length} ${cartoes.length === 1 ? "fatura em aberto" : "faturas em aberto"}`}
          destaque
        />
        <Indicador
          rotulo="Disponível no cartão"
          valor={disponivelNoCartao}
          contexto={`de ${moeda(limiteTotal)} de limite`}
        />
      </section>

      <section aria-label="Contas conectadas" className="flex flex-col gap-3">
        <h2 className="text-tinta-3 text-xs font-semibold tracking-[0.06em] uppercase">
          Contas conectadas
        </h2>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {contas.map((conta) =>
            conta.tipo === "CREDIT" ? (
              <CartaoCredito key={conta.id} conta={conta} hoje={hoje} />
            ) : (
              <CartaoCorrente key={conta.id} conta={conta} fluxo={porConta.get(conta.id)} />
            ),
          )}
        </div>
      </section>
    </>
  );
}
