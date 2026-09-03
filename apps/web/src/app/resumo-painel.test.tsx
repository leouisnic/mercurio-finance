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
  obrigacaoDas: {
    competencia: "2026-08",
    valor: 86.05,
    paga: false,
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

test("mostra o valor e o status da obrigação do DAS", () => {
  render(<ResumoPainel resumo={RESUMO_FICTICIO} />);

  expect(
    screen.getByRole("heading", { level: 2, name: /DAS \(2026-08\)/ }),
  ).toBeDefined();
  expect(screen.getByText("R$ 86,05")).toBeDefined();
  expect(screen.getByText("Ainda não pago nesta competência.")).toBeDefined();
});

test("mostra que o DAS já foi pago quando paga é true", () => {
  render(
    <ResumoPainel
      resumo={{ ...RESUMO_FICTICIO, obrigacaoDas: { ...RESUMO_FICTICIO.obrigacaoDas, paga: true } }}
    />,
  );

  expect(screen.getByText("Já pago nesta competência.")).toBeDefined();
});
