import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

test("mostra o título Vértice e as três titularidades", () => {
  render(<Home />);

  expect(screen.getByRole("heading", { level: 1, name: "Vértice" })).toBeDefined();
  expect(screen.getByText("Pessoa Física")).toBeDefined();
  expect(screen.getByText("Pessoa Jurídica")).toBeDefined();
  expect(screen.getByText("MEI")).toBeDefined();
});

test("mostra o valor reservado e o valor previsto do DAS, formatados em reais", () => {
  render(<Home />);

  expect(
    screen.getByRole("heading", { level: 2, name: /Reserva do DAS/ }),
  ).toBeDefined();
  expect(screen.getByText("R$ 620,00")).toBeDefined();
  expect(screen.getByText(/R\$ 650,00/)).toBeDefined();
});
