import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test } from "vitest";
import type { ContaFixa, DinheiroLivre } from "../buscar-dinheiro-livre";
import { ProvedorDeDicas } from "../info";
import { ComposicaoDoSaldo } from "./composicao-do-saldo";
import { GraficoDoCiclo, tetoDaEscala } from "./grafico-do-ciclo";
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

test("um dia muito acima dos outros é cortado no teto, e a escala segue os demais", () => {
  // 1.720 é mais de 2,5 vezes o segundo maior (310): o teto fica em 310 vezes 1,25.
  expect(tetoDaEscala([1720, 38.5, 310, 132.4], 42.3)).toBeCloseTo(387.5);
  // Sem dia fora do comum, o teto acompanha o maior com folga.
  expect(tetoDaEscala([120, 80, 60], 42.3)).toBeCloseTo(132);
  // Ciclo sem gasto ainda mostra a cota na altura certa.
  expect(tetoDaEscala([], 42.3)).toBeCloseTo(46.53);
});

test("o dia fora da escala mostra o valor escrito e a legenda explica o corte", () => {
  montar(
    <GraficoDoCiclo
      inicio="2026-10-15"
      fim="2026-10-20"
      hoje="2026-10-18"
      cota={42.3}
      gastos={[
        { data: "2026-10-15", total: 1720 },
        { data: "2026-10-16", total: 38.5 },
        { data: "2026-10-17", total: 310 },
      ]}
    />,
  );

  const grafico = screen.getByRole("region", { name: "Gasto por dia e cota" });
  expect(within(grafico).getByText("Cota do dia")).toBeDefined();
  expect(grafico.textContent).toMatch(/R\$\s1\.720,00/);
  expect(within(grafico).getByText("Fora da escala")).toBeDefined();
  expect(within(grafico).getByText(/^R\$\s1\.720,00, acima da cota$/)).toBeDefined();
  // O valor curto em cima da barra, com moeda.
  expect(within(grafico).getByText("R$ 1.720").className).toContain("alerta");
  expect(within(grafico).getByText("R$ 39").className).not.toContain("alerta");
  // A cor da barra: vermelha acima da cota, índigo dentro, dourada sem gasto.
  expect(within(grafico).getByText("R$ 1.720").parentElement?.className).toContain("bg-alerta-forte");
  expect(within(grafico).getByText("R$ 39").parentElement?.className).toContain("bg-marca");
  expect(within(grafico).getByRole("button", { name: /18\/10/ }).innerHTML).toContain("bg-caixinha");
  // Dia sem gasto em dourado; os dias que ainda vêm não têm barra.
  expect(within(grafico).getByText("Sem gasto")).toBeDefined();
  expect(within(grafico).queryByRole("button", { name: /19\/10/ })).toBeNull();
});

test("sem dia fora da escala, a legenda não fala de corte", () => {
  montar(
    <GraficoDoCiclo
      inicio="2026-10-15"
      fim="2026-10-17"
      hoje="2026-10-16"
      cota={42.3}
      gastos={[{ data: "2026-10-15", total: 60 }]}
    />,
  );

  expect(screen.queryByText("Fora da escala")).toBeNull();
});
