import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ResumoPainel } from "./resumo-painel";
import type { Conta } from "./buscar-resumo";
import type { FluxoDaConta } from "./buscar-movimentos";

const HOJE = new Date(2026, 8, 4); // 04/09/2026

const CORRENTE: Conta = {
  id: "c1",
  nome: "Banco X",
  tipo: "BANK",
  saldo: 480.2,
  limite: null,
  disponivel: null,
  bandeira: null,
  final: null,
  fechamento: null,
  vencimento: null,
};

const CARTAO: Conta = {
  id: "c2",
  nome: "Cartão gold",
  tipo: "CREDIT",
  saldo: 340.04,
  limite: 350,
  disponivel: 9.96,
  bandeira: "MASTERCARD",
  final: "4073",
  fechamento: "2026-09-08",
  vencimento: "2026-09-15",
};

const FLUXOS: FluxoDaConta[] = [
  {
    contaId: "c1",
    nome: "Banco X",
    tipo: "BANK",
    entradas: 2400,
    saidas: 420,
    emRevisao: 0,
  },
];

function montar(contas: Conta[] = [CORRENTE, CARTAO], fluxos: FluxoDaConta[] = FLUXOS) {
  render(<ResumoPainel contas={contas} fluxos={fluxos} hoje={HOJE} />);
}

/** Indicador e card mostram o mesmo número de propósito, então cada
 *  asserção precisa dizer de qual seção está falando. */
function em(secao: "Indicadores" | "Contas conectadas") {
  return within(screen.getByRole("region", { name: secao }));
}

test("conta corrente mostra saldo e o movimento do ciclo", () => {
  montar();

  const contas = em("Contas conectadas");
  expect(contas.getByText("Banco X")).toBeDefined();
  expect(contas.getByText("R$ 480,20")).toBeDefined();
  expect(contas.getByText("+ R$ 2.400,00")).toBeDefined();
  expect(contas.getByText("- R$ 420,00")).toBeDefined();
});

test("cartão mostra fatura, bandeira, final e quantos dias faltam para fechar", () => {
  montar();

  const contas = em("Contas conectadas");
  expect(contas.getByText("Cartão gold")).toBeDefined();
  expect(contas.getByText("R$ 340,04")).toBeDefined();
  expect(contas.getByText("MASTERCARD")).toBeDefined();
  expect(contas.getByText(/4073/)).toBeDefined();
  // 04/09 até 08/09.
  expect(contas.getByText("Fecha em 4 dias")).toBeDefined();
  expect(contas.getByText("vence 15/09")).toBeDefined();
});

test("limite quase estourado pinta a barra de vermelho", () => {
  montar();

  // 340,04 de 350 = 97%.
  const barra = screen.getByRole("meter", { name: /Cartão gold/ });
  expect(barra.getAttribute("aria-valuenow")).toBe("97");
  expect(screen.getByText("97% usado").className).toContain("alerta");
});

test("limite folgado pinta a barra de verde", () => {
  montar([{ ...CARTAO, saldo: 35, disponivel: 315 }], []);

  expect(screen.getByText("10% usado").className).toContain("positivo");
});

test("indicadores somam as contas por natureza", () => {
  montar();

  const indicadores = em("Indicadores");
  expect(indicadores.getByText("R$ 480,20")).toBeDefined(); // saldo em conta
  expect(indicadores.getByText("R$ 340,04")).toBeDefined(); // usado no cartão
  expect(indicadores.getByText("R$ 9,96")).toBeDefined(); // disponível no cartão
  expect(indicadores.getByText("1 conta corrente")).toBeDefined();
  expect(indicadores.getByText("1 fatura em aberto")).toBeDefined();
  expect(indicadores.getByText("de R$ 350,00 de limite")).toBeDefined();
});

test("conta corrente sem movimento no ciclo não mostra entradas e saídas", () => {
  montar([CORRENTE], []);

  expect(screen.queryByText("entradas/saídas no ciclo")).toBeNull();
});

test("vencimento já passado vira dia do mês, não uma data mentirosa", () => {
  // A Pluggy devolve o vencimento de um ciclo já encerrado nos bancos
  // conectados hoje: "vence 05/08" em setembro seria falso.
  montar([{ ...CARTAO, fechamento: null, vencimento: "2026-08-05" }], []);

  expect(screen.getByText("vence todo dia 5")).toBeDefined();
  expect(screen.queryByText(/05\/08/)).toBeNull();
  expect(screen.queryByText(/Fecha em/)).toBeNull();
});

test("vencimento futuro aparece com data cheia", () => {
  montar([{ ...CARTAO, fechamento: null, vencimento: "2026-09-15" }], []);

  expect(screen.getByText("vence 15/09")).toBeDefined();
});

test("nome comprido da Pluggy vira o nome do banco", () => {
  montar(
    [{ ...CORRENTE, nome: "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)" }],
    [],
  );

  const contas = em("Contas conectadas");
  expect(contas.getByText("Nubank")).toBeDefined();
  // O nome cru continua acessível, só não ocupa a tela.
  expect(contas.getByTitle(/Nu Pagamentos S.A./)).toBeDefined();
});

test("conta que a Pluggy não identifica mantém o nome dela", () => {
  montar([{ ...CARTAO, nome: "gold" }], []);

  expect(em("Contas conectadas").getByText("gold")).toBeDefined();
});
