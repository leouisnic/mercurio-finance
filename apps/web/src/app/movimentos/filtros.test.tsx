import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Filtros } from "./filtros";

describe("Filtros", () => {
  test("preserva a data de referência nos links do recorte histórico", () => {
    render(
      <Filtros
        ciclos={[
          { chave: "anterior", ciclo: { numero: 2, inicio: "2026-07-15", fim: "2026-08-04" } },
          { chave: "atual", ciclo: { numero: 1, inicio: "2026-08-05", fim: "2026-08-16" } },
          { chave: "seguinte", ciclo: { numero: 2, inicio: "2026-08-17", fim: "2026-09-03" } },
        ]}
        cicloEscolhido="atual"
        contas={[]}
        contaEscolhida={undefined}
        referencia="2026-08-10"
      />,
    );

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toContain("referencia=2026-08-10");
    }
  });
});
