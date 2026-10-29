import { fireEvent, render, screen } from "@testing-library/react";
import { Tooltip } from "radix-ui";
import type { ReactElement } from "react";
import { expect, test } from "vitest";
import { GraficoGastoDiario } from "./grafico-gasto-diario";

function montar(elemento: ReactElement) {
  return render(<Tooltip.Provider>{elemento}</Tooltip.Provider>);
}

const DIA = { emRevisao: 0, maiores: [] };

test("desenha uma coluna por dia do ciclo, inclusive os dias sem gasto", () => {
  montar(
    <GraficoGastoDiario gastos={[{ data: "2026-09-05", total: 120, ...DIA }]} inicio="2026-09-04" fim="2026-09-08" titulo="Gasto por dia" />,
  );

  // 04, 05, 06, 07 e 08: o dia vazio continua ocupando uma coluna.
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
  expect(screen.getByRole("button", { name: /05\/09: R\$\s120,00/ })).toBeDefined();
  expect(screen.getByRole("button", { name: /06\/09: R\$\s0,00/ })).toBeDefined();
});

test("soma o total do período", () => {
  montar(
    <GraficoGastoDiario
      gastos={[
        { data: "2026-09-04", total: 100, ...DIA },
        { data: "2026-09-05", total: 40.5, ...DIA },
      ]}
      inicio="2026-09-04"
      fim="2026-09-05"
      titulo="Gasto por dia"
    />,
  );

  expect(screen.getByText("total no período: R$ 140,50")).toBeDefined();
});

test("ciclo que atravessa a virada do mês conta os dias certos", () => {
  // Ciclo 2 de setembro de 2026: 15/09 a 04/10, 20 dias.
  montar(<GraficoGastoDiario gastos={[]} inicio="2026-09-15" fim="2026-10-04" titulo="Gasto por dia" />);

  expect(screen.getAllByRole("listitem")).toHaveLength(20);
});

test("com a cota de hoje, o dia acima fica vermelho e o detalhe diz quanto passou", async () => {
  montar(
    <GraficoGastoDiario
      gastos={[
        { data: "2026-09-04", total: 152, emRevisao: 0, maiores: [{ descricao: "Restaurante Exemplo", valor: 86.4 }] },
        { data: "2026-09-05", total: 40, ...DIA },
      ]}
      inicio="2026-09-04"
      fim="2026-09-07"
      titulo="Gasto por dia"
      cota={120}
      hoje="2026-09-05"
    />,
  );

  expect(screen.getByText("R$ 152").className).toContain("alerta");
  expect(screen.getByText("R$ 40").className).not.toContain("alerta");
  // Os dias depois de hoje ficam sem barra e sem botão.
  expect(screen.queryByRole("button", { name: /07\/09/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /04\/09/ }));
  // Dia sem gasto é boa notícia, e diz quanto da cota sobrou.
  expect((await screen.findAllByText("R$ 32,00 acima da cota")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("Restaurante Exemplo")).length).toBeGreaterThan(0);
});

test("ciclo passado não tem cota: sem vermelho e sem linha", () => {
  montar(
    <GraficoGastoDiario gastos={[{ data: "2026-09-04", total: 500, ...DIA }]} inicio="2026-09-04" fim="2026-09-05" titulo="Gasto por dia" />,
  );

  expect(screen.getByText("R$ 500").className).not.toContain("alerta");
  expect(screen.queryByText("Passou da cota")).toBeNull();
  expect(screen.getByText("Com gasto")).toBeDefined();
});
