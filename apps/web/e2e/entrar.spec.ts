import { expect, test } from "@playwright/test";
import { SENHA_DO_E2E } from "./token";

// Começa sem a sessão gravada, como um aparelho novo.
test.use({ storageState: { cookies: [], origins: [] } });

test("sem sessão, qualquer página leva para a entrada", async ({ page }) => {
  await page.goto("/movimentos");

  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mercúrio" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);
});

test("senha errada mostra o erro e não entra", async ({ page }) => {
  await page.goto("/entrar");

  await page.getByLabel("Senha").fill("senha-que-nao-e");
  await page.getByRole("button", { name: "Entrar" }).click();

  // O anunciador de rota do Next também é um alert: filtra pelo texto.
  await expect(page.getByRole("alert").filter({ hasText: "Senha incorreta." })).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);
});

test("entra com a senha e Sair volta para a entrada", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Senha").fill(SENHA_DO_E2E);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).first().click();

  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);
});
