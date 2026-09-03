import { test, expect } from "@playwright/test";

test("Vértice mostra as três titularidades e a reserva do DAS", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Vértice" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Pessoa Física" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Pessoa Jurídica" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "MEI" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: /Reserva do DAS/ }),
  ).toBeVisible();
  await expect(page.getByText("R$ 620,00")).toBeVisible();
  await expect(page.getByText("previsto para o mês: R$ 650,00")).toBeVisible();
});
