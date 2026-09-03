import { test, expect } from "@playwright/test";

test("Vértice mostra o resumo calculado pelo finance-api de verdade", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Vértice" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Pessoa Física" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Pessoa Jurídica (MEI)" }),
  ).toBeVisible();

  // Valores batendo com dados/extrato_ficticio.csv do finance-api, não mais
  // hardcoded no componente: prova de que apps/web busca o dado de verdade.
  await expect(page.getByText("R$ 254,50")).toBeVisible();
  await expect(page.getByText("R$ 2.898,40")).toBeVisible();

  await expect(page.getByRole("heading", { level: 2, name: /DAS \(\d{4}-\d{2}\)/ })).toBeVisible();
  await expect(page.getByText("R$ 86,05")).toBeVisible();
});
