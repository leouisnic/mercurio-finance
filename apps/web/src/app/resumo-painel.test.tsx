import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProvedorDeDicas } from "./info";
import { ResumoPainel } from "./resumo-painel";
import type { Conta } from "./buscar-resumo";
import type { FluxoDaConta } from "./buscar-movimentos";

const HOJE = new Date(2026, 8, 4); // 04/09/2026

const CORRENTE: Conta = {
  id: "c1",
  nome: "Banco X",
  apelido: null,
  tipo: "BANK",
  saldo: 480.2,
  limite: null,
  disponivel: null,
  bandeira: null,
  final: null,
  itemId: null,
  fechamento: null,
  vencimento: null,
};

const CARTAO: Conta = {
  id: "c2",
  nome: "Cartão gold",
  apelido: null,
  tipo: "CREDIT",
  saldo: 340.04,
  limite: 350,
  disponivel: 9.96,
  bandeira: "MASTERCARD",
  final: "4073",
  itemId: null,
  fechamento: "2026-09-08",
  vencimento: "2026-09-15",
};

const FLUXOS: FluxoDaConta[] = [
  {
    contaId: "c1",
    nome: "Banco X",
    apelido: null,
    tipo: "BANK",
    entradas: 2400,
    saidas: 420,
    emRevisao: 0,
    faturaPaga: 300,
    transferenciasEntrada: 50,
    transferenciasSaida: 100,
  },
];

function montar(contas: Conta[] = [CORRENTE, CARTAO], fluxos: FluxoDaConta[] = FLUXOS) {
  render(
    <ProvedorDeDicas>
      <ResumoPainel contas={contas} fluxos={fluxos} hoje={HOJE} />
    </ProvedorDeDicas>,
  );
}

function em(secao: "Contas conectadas") {
  return within(screen.getByRole("region", { name: secao }));
}

test("conta corrente soma fatura e transferências no que entrou e saiu", () => {
  montar();

  const contas = em("Contas conectadas");
  expect(contas.getByText("Banco X")).toBeDefined();
  // Uma conta só na coluna: o total da coluna repete o valor do cartão.
  expect(contas.getAllByText("R$ 480,20")).toHaveLength(2);
  // Entrou: 2.400 de receita e 50 vindos de outra conta. Saiu: 420 de gasto,
  // 300 de fatura e 100 para outra conta. Sem fatura e transferências, a
  // variação seria + R$ 1.980,00 e não bateria com o saldo.
  expect(contas.getByText("R$ 2.450,00")).toBeDefined();
  expect(contas.getByText("R$ 820,00")).toBeDefined();
  expect(contas.getByText("+ R$ 1.630,00")).toBeDefined();
});

test("cartão mostra fatura, bandeira, final e quantos dias faltam para fechar", () => {
  montar();

  const contas = em("Contas conectadas");
  expect(contas.getByText("Cartão gold")).toBeDefined();
  // Uma conta só na coluna: o total da coluna repete o valor do cartão.
  expect(contas.getAllByText("R$ 340,04")).toHaveLength(2);
  expect(contas.getByRole("img", { name: "Mastercard" })).toBeDefined();
  expect(contas.getByText("4073")).toBeDefined();
  expect(contas.queryByText(/·/)).toBeNull();
  // 04/09 até 08/09.
  expect(contas.getByText("fatura atual, fecha em 4 dias e vence 15/09")).toBeDefined();
  expect(contas.getByText("Limite R$ 350,00")).toBeDefined();
  expect(contas.getByText("R$ 9,96 disponível")).toBeDefined();
});

test("limite quase estourado pinta a barra de vermelho", () => {
  montar();

  // 340,04 de 350 = 97%.
  const barra = screen.getByRole("meter", { name: /Cartão gold/ });
  expect(barra.getAttribute("aria-valuenow")).toBe("97");
  expect(screen.getByText("97% do limite").className).toContain("alerta");
});

test("limite folgado pinta a barra de verde", () => {
  montar([{ ...CARTAO, saldo: 35, disponivel: 315 }], []);

  expect(screen.getByText("10% do limite").className).toContain("positivo");
});

test("conta corrente sem movimento no ciclo não mostra entradas e saídas", () => {
  montar([CORRENTE], []);

  expect(screen.getByText("Entrou")).toBeDefined();
  expect(screen.getAllByText("R$ 0,00")).toHaveLength(2);
  expect(screen.getByText("+ R$ 0,00")).toBeDefined();
});

test("vencimento já passado vira dia do mês, não uma data mentirosa", () => {
  // A Pluggy devolve o vencimento de um ciclo já encerrado nos bancos
  // conectados hoje: "vence 05/08" em setembro seria falso.
  montar([{ ...CARTAO, fechamento: null, vencimento: "2026-08-05" }], []);

  expect(screen.getByText("fatura atual, vence dia 5")).toBeDefined();
  expect(screen.queryByText(/05\/08/)).toBeNull();
  expect(screen.queryByText(/fecha em/)).toBeNull();
});

test("vencimento futuro aparece com data cheia", () => {
  montar([{ ...CARTAO, fechamento: null, vencimento: "2026-09-15" }], []);

  expect(screen.getByText("fatura atual, vence 15/09")).toBeDefined();
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

test("apelido substitui o nome e traz a cor do banco junto", () => {
  // O cartao do Nubank chega da Pluggy como "gold", sem nada que diga o banco.
  montar([{ ...CARTAO, nome: "gold", apelido: "Cartão Nubank" }], []);

  const contas = em("Contas conectadas");
  expect(contas.getByText("Cartão Nubank")).toBeDefined();
  expect(contas.queryByText("gold")).toBeNull();
  // O nome cru continua acessivel no title.
  expect(contas.getByTitle("gold")).toBeDefined();
});
