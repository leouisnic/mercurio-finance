import { test, expect } from "@playwright/test";

test("Vértice mostra o resumo calculado pelo finance-api de verdade", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Vértice" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Conta A (fictícia)" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Conta B (fictícia)" })).toBeVisible();

  // Valores batendo com o que finance_api.seed grava nas contas, não mais
  // hardcoded no componente: prova de que apps/web busca o dado de verdade.
  await expect(page.getByText("R$ 2.898,40")).toBeVisible();
  await expect(page.getByText("R$ 254,50")).toBeVisible();
});
