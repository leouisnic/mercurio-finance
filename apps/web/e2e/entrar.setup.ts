import { expect, test as preparar } from "@playwright/test";
import { SENHA_DO_E2E, SESSAO_GRAVADA } from "./token";

preparar("entra com a senha e grava a sessão", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);

  await page.getByLabel("Senha").fill(SENHA_DO_E2E);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();
  await page.context().storageState({ path: SESSAO_GRAVADA });
});
