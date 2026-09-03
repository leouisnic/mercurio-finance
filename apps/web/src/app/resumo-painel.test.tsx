import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumoPainel } from "./resumo-painel";
import type { ResumoFinanceiro } from "./buscar-resumo";

const RESUMO_FICTICIO: ResumoFinanceiro = {
  atualizadoEm: "2026-08-15",
  contas: [
    { id: "c1", nome: "Banco X", tipo: "BANK", saldo: 480.2, limite: null, disponivel: null },
    {
      id: "c2",
      nome: "Cartão gold",
      tipo: "CREDIT",
      saldo: 340.04,
      limite: 350,
      disponivel: 9.96,
    },
  ],
};

test("mostra saldo de conta corrente em verde", () => {
  render(<ResumoPainel resumo={RESUMO_FICTICIO} />);

  expect(screen.getByRole("heading", { level: 2, name: "Banco X" })).toBeDefined();
  expect(screen.getByText("Saldo")).toBeDefined();
  const saldo = screen.getByText("R$ 480,20");
  expect(saldo.className).toContain("emerald");
});

test("mostra fatura de cartão de crédito com limite disponível, em laranja", () => {
  render(<ResumoPainel resumo={RESUMO_FICTICIO} />);

  expect(screen.getByRole("heading", { level: 2, name: "Cartão gold" })).toBeDefined();
  expect(screen.getByText("Fatura atual")).toBeDefined();
  const fatura = screen.getByText("R$ 340,04");
  expect(fatura.className).toContain("amber");
  expect(screen.getByText("R$ 9,96 disponível de R$ 350,00")).toBeDefined();
});

test("mostra a data de atualização", () => {
  render(<ResumoPainel resumo={RESUMO_FICTICIO} />);

  expect(screen.getByText("Atualizado em 2026-08-15")).toBeDefined();
});
