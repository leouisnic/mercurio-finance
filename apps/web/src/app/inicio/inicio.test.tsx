import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test } from "vitest";
import type { ContaFixa, DinheiroLivre } from "../buscar-dinheiro-livre";
import { ProvedorDeDicas } from "../info";
import { ComposicaoDoSaldo } from "./composicao-do-saldo";
import { HojeDaParaGastar } from "./hoje-da-para-gastar";
import { LinhaDoTempo } from "./linha-do-tempo";

const DINHEIRO: DinheiroLivre = {
  hoje: "2026-10-10",
  ciclo: { numero: 1, inicio: "2026-10-05", fim: "2026-10-14" },
  cicloSeguinte: { numero: 2, inicio: "2026-10-15", fim: "2026-11-04" },
  saldoContas: 3152.9,
  cartaoUsado: 640.3,
  contasFixas: [
    { nome: "Internet", valor: 99.9, dataPrevista: "2026-10-12", origem: "recorrencia", atrasada: false },
    { nome: "Academia", valor: 89, dataPrevista: "2026-10-13", origem: "recorrencia", atrasada: false },
  ],
  contasFixasTotal: 188.9,
  caixinha: 380,
  livre: 1943.7,
  diasDoCiclo: 10,
  diasRestantes: 5,
  cotaDoDia: 268.74,
  cofrinho: 600,
  gastoHoje: 0,
  hojeDisponivel: 868.74,
  gastosPorDia: [],
};

function montar(conteudo: ReactNode) {
  return render(<ProvedorDeDicas>{conteudo}</ProvedorDeDicas>);
}

function fixa(nome: string, dia: number, valor: number, atrasada = false): ContaFixa {
  return { nome, valor, dataPrevista: `2026-10-${String(dia).padStart(2, "0")}`, origem: "recorrencia", atrasada };
}

test("hoje mostra o disponível, a cota e o cofrinho da conta da spec", () => {
  montar(<HojeDaParaGastar dinheiro={DINHEIRO} />);

  const bloco = within(screen.getByRole("region", { name: "Hoje dá para gastar" }));
  expect(bloco.getByText("R$ 868,74")).toBeDefined();
  expect(bloco.getByText("R$ 268,74")).toBeDefined();
  expect(bloco.getByText("+ R$ 600,00")).toBeDefined();
});

test("gasto acima do que o ciclo comporta aparece negativo e com aviso", () => {
  montar(<HojeDaParaGastar dinheiro={{ ...DINHEIRO, hojeDisponivel: -120, cofrinho: -388.74, gastoHoje: 0 }} />);

  expect(screen.getByText("- R$ 120,00")).toBeDefined();
  expect(screen.getByText("- R$ 388,74")).toBeDefined();
  expect(screen.getByRole("status").textContent).toMatch(/além do que o ciclo comporta/);
});

test("a composição mostra cada parte do saldo e as contas fixas com a data", () => {
  montar(<ComposicaoDoSaldo dinheiro={DINHEIRO} temCartao />);

  const saldo = within(screen.getByRole("region", { name: "Saldo nas contas" }));
  expect(saldo.getByText("R$ 640,30")).toBeDefined();
  expect(saldo.getByText("R$ 188,90")).toBeDefined();
  expect(saldo.getByText("R$ 380,00")).toBeDefined();
  expect(saldo.getByText("R$ 1.943,70")).toBeDefined();
  expect(saldo.getByText("Internet")).toBeDefined();
  expect(saldo.getByText("R$ 99,90")).toBeDefined();
});

test("sem cartão conectado, o cartão diz isso em vez de mostrar zero", () => {
  montar(<ComposicaoDoSaldo dinheiro={{ ...DINHEIRO, cartaoUsado: 0 }} temCartao={false} />);

  expect(screen.getByText("sem cartão conectado")).toBeDefined();
});

test("mais de três contas fixas: três na lista e o resto somado", () => {
  const contasFixas = [
    fixa("Internet", 11, 99.9),
    fixa("Academia", 12, 89),
    fixa("Celular", 12, 50),
    fixa("Seguro", 13, 80),
    fixa("Streaming", 14, 39.9),
  ];
  montar(<ComposicaoDoSaldo dinheiro={{ ...DINHEIRO, contasFixas }} temCartao />);

  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByText(/\+ 2 contas/)).toBeDefined();
  expect(screen.getByText("R$ 119,90")).toBeDefined();
});

test("conta fixa atrasada fica marcada", () => {
  montar(<ComposicaoDoSaldo dinheiro={{ ...DINHEIRO, contasFixas: [fixa("Internet", 7, 99.9, true)] }} temCartao />);

  expect(screen.getByText("atrasada, prevista para 07/10")).toBeDefined();
});

test("livre negativo aparece negativo na legenda", () => {
  montar(<ComposicaoDoSaldo dinheiro={{ ...DINHEIRO, livre: -250 }} temCartao />);

  expect(screen.getByText("- R$ 250,00")).toBeDefined();
});

test("sem conta fixa prevista, a tela leva a aprovar recorrências", () => {
  montar(<ComposicaoDoSaldo dinheiro={{ ...DINHEIRO, contasFixas: [], contasFixasTotal: 0 }} temCartao />);

  expect(screen.getByRole("link", { name: "Aprovar recorrências" }).getAttribute("href")).toBe("/recorrencias");
});

test("a linha do tempo usa o nome de quem paga e cai no dia quando não há nome", () => {
  const { unmount } = montar(
    <LinhaDoTempo
      hoje={DINHEIRO.hoje}
      ciclo={DINHEIRO.ciclo}
      cicloSeguinte={DINHEIRO.cicloSeguinte}
      pagadores={{ ciclo1: "Empresa A", ciclo2: "Empresa B" }}
    />,
  );
  expect(screen.getByText(/dia 6 de 10 do Ciclo Empresa A/)).toBeDefined();
  expect(screen.getByText(/para Empresa B pagar/)).toBeDefined();
  unmount();

  montar(
    <LinhaDoTempo
      hoje={DINHEIRO.hoje}
      ciclo={DINHEIRO.ciclo}
      cicloSeguinte={DINHEIRO.cicloSeguinte}
      pagadores={{ ciclo1: null, ciclo2: null }}
    />,
  );
  expect(screen.getByText(/do Ciclo do dia 5/)).toBeDefined();
  expect(screen.getByText(/para o próximo pagamento/)).toBeDefined();
});
