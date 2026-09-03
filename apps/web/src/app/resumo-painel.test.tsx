import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumoPainel } from "./resumo-painel";
import type { ResumoFinanceiro } from "./buscar-resumo";

const RESUMO_FICTICIO: ResumoFinanceiro = {
  atualizadoEm: "2026-08-15",
  titularidades: [
    { id: "pf", nome: "Pessoa Física", saldo: 254.5 },
    { id: "pj", nome: "Pessoa Jurídica (MEI)", saldo: 2898.4 },
  ],
  reservaDas: {
    referencia: "competência atual",
    valorReservado: 620,
    valorPrevisto: 650,
  },
};

test("mostra PF e PJ (MEI) com o saldo formatado em reais", () => {
  render(<ResumoPainel resumo={RESUMO_FICTICIO} />);

  expect(screen.getByRole("heading", { level: 2, name: "Pessoa Física" })).toBeDefined();
  expect(
    screen.getByRole("heading", { level: 2, name: "Pessoa Jurídica (MEI)" }),
  ).toBeDefined();
  expect(screen.getByText("R$ 254,50")).toBeDefined();
  expect(screen.getByText("R$ 2.898,40")).toBeDefined();
});

test("mostra o valor reservado e o valor previsto do DAS", () => {
  render(<ResumoPainel resumo={RESUMO_FICTICIO} />);

  expect(
    screen.getByRole("heading", { level: 2, name: /Reserva do DAS/ }),
  ).toBeDefined();
  expect(screen.getByText("R$ 620,00")).toBeDefined();
  expect(screen.getByText(/R\$ 650,00/)).toBeDefined();
});
