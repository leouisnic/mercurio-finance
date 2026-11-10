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
    {
      nome: "Internet",
      valor: 99.9,
      dataPrevista: "2026-10-12",
      origem: "recorrencia",
      atrasada: false,
    },
    {
      nome: "Academia",
      valor: 89,
      dataPrevista: "2026-10-13",
      origem: "recorrencia",
      atrasada: false,
    },
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
  guardadoNoCiclo: 0,
  guardadoEm: null,
  daParaGuardar: null,
  faltaParaFechar: 0,
  gastosPorDia: [],
};

function montar(conteudo: ReactNode) {
  return render(<ProvedorDeDicas>{conteudo}</ProvedorDeDicas>);
}

function fixa(
  nome: string,
  dia: number,
  valor: number,
  atrasada = false,
): ContaFixa {
  return {
    nome,
    valor,
    dataPrevista: `2026-10-${String(dia).padStart(2, "0")}`,
    origem: "recorrencia",
    atrasada,
  };
}

test("hoje mostra o disponível, a cota e o cofrinho da conta da spec", () => {
  montar(<HojeDaParaGastar dinheiro={DINHEIRO} />);

  const bloco = within(
    screen.getByRole("region", { name: "Hoje dá para gastar" }),
  );
  expect(bloco.getByText("R$ 868,74")).toBeDefined();
  expect(bloco.getByText("R$ 268,74")).toBeDefined();
  expect(bloco.getByText("+ R$ 600,00")).toBeDefined();
});

function quadros() {
  return within(
    screen.getByRole("region", { name: "Hoje dá para gastar" }),
  ).getAllByText(
    /^(Cota do dia|Cofrinho|Guardado no ciclo|Dá para guardar|Falta para fechar|Próximo pagamento)$/,
  );
}

test("gasto acima do que o dia comporta aparece negativo, sem mudar os quadros", () => {
  montar(
    <HojeDaParaGastar
      dinheiro={{
        ...DINHEIRO,
        hojeDisponivel: -120,
        cofrinho: -388.74,
        gastoHoje: 0,
      }}
    />,
  );

  expect(screen.getByText("- R$ 120,00")).toBeDefined();
  expect(screen.getByText("- R$ 388,74")).toBeDefined();
  expect(quadros()).toHaveLength(4);
});

test("sem histórico, dá para guardar diz isso em vez de mostrar zero", () => {
  montar(<HojeDaParaGastar dinheiro={DINHEIRO} />);

  expect(screen.getByText("Sem histórico")).toBeDefined();
  expect(screen.getByText("Guardado no ciclo")).toBeDefined();
});

test("a recomendação aparece no quadro e o guardado traz a data ao lado", () => {
  montar(
    <HojeDaParaGastar
      dinheiro={{
        ...DINHEIRO,
        daParaGuardar: 650,
        guardadoNoCiclo: 350,
        guardadoEm: "2026-10-10",
      }}
    />,
  );

  expect(screen.getByText("R$ 650,00")).toBeDefined();
  expect(screen.getByText("R$ 350,00")).toBeDefined();
  expect(screen.getByText("10/10")).toBeDefined();
});

test("resgate de outro ciclo não mostra guardado negativo", () => {
  montar(
    <HojeDaParaGastar
      dinheiro={{ ...DINHEIRO, guardadoNoCiclo: -300, daParaGuardar: 100 }}
    />,
  );

  expect(screen.getByText("R$ 0,00")).toBeDefined();
  expect(screen.queryByText("- R$ 300,00")).toBeNull();
});

test("livre negativo mostra zero, a falta e o próximo pagamento no lugar de cota e cofrinho", () => {
  montar(
    <HojeDaParaGastar
      dinheiro={{
        ...DINHEIRO,
        livre: -50,
        hojeDisponivel: 0,
        faltaParaFechar: 50,
        daParaGuardar: 0,
      }}
    />,
  );

  const bloco = within(
    screen.getByRole("region", { name: "Hoje dá para gastar" }),
  );
  expect(bloco.getByText("R$ 50,00")).toBeDefined();
  expect(bloco.getByText("15/10")).toBeDefined();
  expect(bloco.getByText("Em 5 dias")).toBeDefined();
  expect(bloco.queryByText("Cota do dia")).toBeNull();
  expect(bloco.queryByText("Cofrinho")).toBeNull();
  expect(quadros()).toHaveLength(4);
});

test("a composição mostra cada parte do saldo e as contas fixas com a data", () => {
  montar(<ComposicaoDoSaldo dinheiro={DINHEIRO} temCartao />);

  const saldo = within(
    screen.getByRole("region", { name: "Saldo nas contas" }),
  );
  expect(saldo.getByText("R$ 640,30")).toBeDefined();
  expect(saldo.getByText("R$ 188,90")).toBeDefined();
  expect(saldo.getByText("R$ 380,00")).toBeDefined();
  expect(saldo.getByText("R$ 1.943,70")).toBeDefined();
  expect(saldo.getByText("Internet")).toBeDefined();
  expect(saldo.getByText("R$ 99,90")).toBeDefined();
});

test("sem cartão conectado, o cartão diz isso em vez de mostrar zero", () => {
  montar(
    <ComposicaoDoSaldo
      dinheiro={{ ...DINHEIRO, cartaoUsado: 0 }}
      temCartao={false}
    />,
  );

  expect(screen.getByText("Sem cartão conectado")).toBeDefined();
});

test("mais de três contas fixas: três na lista e o resto somado", () => {
  const contasFixas = [
    fixa("Internet", 11, 99.9),
    fixa("Academia", 12, 89),
    fixa("Celular", 12, 50),
    fixa("Seguro", 13, 80),
    fixa("Streaming", 14, 39.9),
  ];
  montar(
    <ComposicaoDoSaldo dinheiro={{ ...DINHEIRO, contasFixas }} temCartao />,
  );

  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByText(/\+ 2 contas/)).toBeDefined();
  expect(screen.getByText("R$ 119,90")).toBeDefined();
});

test("conta fixa atrasada fica marcada", () => {
  montar(
    <ComposicaoDoSaldo
      dinheiro={{ ...DINHEIRO, contasFixas: [fixa("Internet", 7, 99.9, true)] }}
      temCartao
    />,
  );

  expect(screen.getByText("Atrasada, prevista para 07/10")).toBeDefined();
});

test("livre negativo aparece negativo na legenda", () => {
  montar(
    <ComposicaoDoSaldo dinheiro={{ ...DINHEIRO, livre: -250 }} temCartao />,
  );

  expect(screen.getByText("- R$ 250,00")).toBeDefined();
});

test("sem conta fixa prevista, a tela leva a aprovar recorrências", () => {
  montar(
    <ComposicaoDoSaldo
      dinheiro={{ ...DINHEIRO, contasFixas: [], contasFixasTotal: 0 }}
      temCartao
    />,
  );

  expect(
    screen
      .getByRole("link", { name: "Aprovar recorrências" })
      .getAttribute("href"),
  ).toBe("/recorrencias");
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
  // Cota e média só na ponta das linhas. Média de 15 a 18/10:
  // (1.720 + 38,50 + 310 + 0) / 4 = 517,125; projeção dos dois dias que
  // faltam no mesmo ritmo: 2.068,50 + 2 x 517,125 = 3.102,75.
  expect(within(grafico).getByText(/^Cota R\$\s42,30$/)).toBeDefined();
  expect(within(grafico).getByText(/^Média R\$\s517,13$/)).toBeDefined();
  expect(
    within(grafico).getByRole("button", {
      name: /^Projeção do período: R\$\s3\.102,75$/,
    }),
  ).toBeDefined();
  expect(grafico.textContent).toMatch(/R\$\s1\.720,00/);
  expect(within(grafico).getByText("Fora da escala")).toBeDefined();
  expect(
    within(grafico).getByText(/^R\$\s1\.720,00, acima da cota$/),
  ).toBeDefined();
  // Nada escrito sobre as barras. A cor: vermelha acima da cota, índigo
  // dentro, dourada sem gasto; o maior dia (15/10) com listras.
  expect(within(grafico).queryByText("R$ 1.720")).toBeNull();
  const barra = (dia: RegExp) =>
    within(grafico).getByRole("button", { name: dia }).innerHTML;
  expect(barra(/15\/10/)).toContain("bg-alerta-forte");
  expect(barra(/15\/10/)).toContain(
    "repeating-linear-gradient(135deg, transparent",
  );
  expect(barra(/16\/10/)).toContain("bg-marca");
  expect(barra(/16\/10/)).not.toContain(
    "repeating-linear-gradient(135deg, transparent",
  );
  expect(
    within(grafico).getByRole("button", { name: /18\/10/ }).innerHTML,
  ).toContain("bg-caixinha");
  // Dia sem gasto em dourado; os dias que ainda vêm não têm barra.
  expect(within(grafico).getByText("Dia de ouro")).toBeDefined();
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

test("o eixo mostra a letra do dia e marca fim de semana e feriado só na letra", () => {
  // 17 de outubro de 2026 é sábado; o dia 20 é um feriado fictício da cidade.
  montar(
    <GraficoDoCiclo
      inicio="2026-10-15"
      fim="2026-10-20"
      hoje="2026-10-20"
      cota={42.3}
      gastos={[{ data: "2026-10-15", total: 10 }]}
      naoUteis={[
        { data: "2026-10-17", feriado: null },
        { data: "2026-10-18", feriado: null },
        { data: "2026-10-20", feriado: "Aniversário da Cidade A" },
      ]}
    />,
  );

  const grafico = screen.getByRole("region", { name: "Gasto por dia e cota" });
  const letras = [
    ...grafico.querySelectorAll("[aria-hidden] > span + span"),
  ].filter((letra) => /^[DSTQ]$/.test(letra.textContent ?? ""));
  expect(letras.map((letra) => letra.textContent).join("")).toBe("QSSDST");
  // Fim de semana e feriado na mesma cor: o balão diz qual é.
  expect(letras[2].className).toContain("bg-nao-util");
  expect(letras[5].className).toContain("bg-nao-util");
  expect(letras[4].className).not.toContain("bg-");
  expect(within(grafico).getByText(/Aniversário da Cidade A/)).toBeDefined();
});
