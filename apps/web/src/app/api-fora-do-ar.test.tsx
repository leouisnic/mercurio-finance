import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { Conta } from "./buscar-resumo";
import type { Recorrencia } from "./buscar-recorrencias";

// Cada tela é renderizada com as buscas falhando, como `buscarJson` faz
// quando a API cai: devolve `null`. Nenhum número pode aparecer como zero.

const buscas = vi.hoisted(() => ({
  buscarCiclos: vi.fn(),
  buscarGastosDiarios: vi.fn(),
  buscarFluxoPorConta: vi.fn(),
  buscarMovimentos: vi.fn(),
  buscarResumo: vi.fn(),
  buscarRecorrencias: vi.fn(),
}));

vi.mock("./buscar-movimentos", () => buscas);
vi.mock("./buscar-resumo", () => ({ buscarResumo: buscas.buscarResumo }));
vi.mock("./buscar-recorrencias", async (original) => ({
  ...(await original<typeof import("./buscar-recorrencias")>()),
  buscarRecorrencias: buscas.buscarRecorrencias,
}));
vi.mock("./acoes", () => ({
  sincronizar: vi.fn(),
  decidirRecorrencia: vi.fn(),
  renomearConta: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { default: VisaoGeral } = await import("./page");
const { default: Movimentos } = await import("./movimentos/page");
const { default: Recorrencias } = await import("./recorrencias/page");

const CICLOS = {
  anterior: { numero: 2, inicio: "2026-07-15", fim: "2026-08-04" },
  atual: { numero: 1, inicio: "2026-08-05", fim: "2026-08-16" },
  seguinte: { numero: 2, inicio: "2026-08-17", fim: "2026-09-03" },
};

const CONTA: Conta = {
  id: "conta-a",
  nome: "Conta A (fictícia)",
  apelido: null,
  tipo: "BANK",
  saldo: 2898.4,
  limite: null,
  disponivel: null,
  bandeira: null,
  final: null,
  fechamento: null,
  vencimento: null,
};

const PENDENTE: Recorrencia = {
  id: 1,
  contaId: "conta-a",
  descricao: "Assinatura streaming",
  apelido: null,
  categoria: null,
  valorMedio: 65,
  ocorrencias: 3,
  primeiraData: "2026-06-10",
  ultimaData: "2026-08-10",
  status: "pendente",
};

beforeEach(() => {
  for (const busca of Object.values(buscas)) {
    busca.mockReset();
    busca.mockResolvedValue(null);
  }
});

function semZero() {
  expect(document.body.textContent).not.toMatch(/R\$\s0,00/);
}

test("Movimentos com a API falhando nos dados do ciclo avisa e não mostra zero", async () => {
  buscas.buscarCiclos.mockResolvedValue(CICLOS);

  render(await Movimentos({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }));

  const faixa = screen.getByRole("alert");
  expect(faixa.textContent).toMatch(/gasto por dia/);
  expect(faixa.textContent).toMatch(/comparativo com o ciclo anterior/);
  expect(faixa.textContent).toMatch(/nada aqui é zero/);
  expect(within(screen.getByRole("region", { name: "Gasto por dia" })).getByText("Indisponível"));
  expect(
    within(screen.getByRole("region", { name: "Comparativo com o ciclo anterior" })).getByText(
      "Indisponível",
    ),
  );
  expect(screen.queryByText("Nenhum movimento neste recorte.")).toBeNull();
  expect(screen.queryByText("Nenhuma saída neste recorte.")).toBeNull();
  semZero();
});

test("Movimentos: só o ciclo anterior falhando já derruba o comparativo", async () => {
  buscas.buscarCiclos.mockResolvedValue(CICLOS);
  buscas.buscarGastosDiarios.mockImplementation(async (inicio: string) =>
    inicio === CICLOS.atual.inicio ? [{ data: "2026-08-06", total: 50, emRevisao: 0 }] : null,
  );

  render(await Movimentos({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }));

  expect(
    within(screen.getByRole("region", { name: "Comparativo com o ciclo anterior" })).getByText(
      "Indisponível",
    ),
  );
  // Aqui R$ 0,00 aparece de verdade: os dias sem gasto do ciclo que carregou.
  expect(screen.queryByText(/^Ciclo anterior:/)).toBeNull();
});

test("Visão geral sem o fluxo do ciclo avisa em vez de esconder entradas e saídas", async () => {
  buscas.buscarResumo.mockResolvedValue({ atualizadoEm: null, contas: [CONTA] });

  render(await VisaoGeral());

  expect(screen.getByRole("alert").textContent).toMatch(/entradas e saídas do ciclo/);
  expect(screen.getByText("Indisponível")).toBeDefined();
});

test("Recorrências com as decididas falhando não mostra metade da lista", async () => {
  buscas.buscarRecorrencias.mockImplementation(async (status: string) =>
    status === "pendente" ? [PENDENTE] : status === "aprovada" ? [] : null,
  );

  render(await Recorrencias());

  expect(screen.getByRole("alert").textContent).toMatch(/recorrências já decididas/);
  expect(
    within(screen.getByRole("region", { name: "Já decididas" })).getByText("Indisponível"),
  ).toBeDefined();
});

test("com a API toda fora, as três telas mostram a faixa e nenhum zero", async () => {
  for (const tela of [
    await VisaoGeral(),
    await Movimentos({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }),
    await Recorrencias(),
  ]) {
    const { unmount } = render(tela);
    expect(screen.getByRole("alert").textContent).toMatch(/A API não respondeu/);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeDefined();
    semZero();
    unmount();
  }
});
