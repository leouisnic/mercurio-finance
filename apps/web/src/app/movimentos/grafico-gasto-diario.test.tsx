import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { GraficoGastoDiario } from "./grafico-gasto-diario";

test("desenha uma coluna por dia do ciclo, inclusive os dias sem gasto", () => {
  render(
    <GraficoGastoDiario
      gastos={[{ data: "2026-09-05", total: 120, emRevisao: 0 }]}
      inicio="2026-09-04"
      fim="2026-09-08"
      titulo="Gasto por dia"
    />,
  );

  // 04, 05, 06, 07 e 08: o dia vazio continua ocupando uma coluna.
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
  expect(screen.getByTitle("05/09: R$ 120,00")).toBeDefined();
  expect(screen.getByTitle("06/09: R$ 0,00")).toBeDefined();
});

test("soma o total do período", () => {
  render(
    <GraficoGastoDiario
      gastos={[
        { data: "2026-09-04", total: 100, emRevisao: 0 },
        { data: "2026-09-05", total: 40.5, emRevisao: 0 },
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
  render(
    <GraficoGastoDiario gastos={[]} inicio="2026-09-15" fim="2026-10-04" titulo="Gasto por dia" />,
  );

  expect(screen.getAllByRole("listitem")).toHaveLength(20);
});
