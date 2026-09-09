import { expect, test } from "@playwright/test";
import path from "node:path";

const gerarCapturas = process.env.GERAR_CAPTURAS === "1";
const pastaDeCapturas = path.resolve(__dirname, "../../../docs/telas");

test.skip(!gerarCapturas, "capturas públicas são geradas somente sob demanda");

test("gera capturas públicas com a base fictícia do e2e", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto("/");
  await expect(page.getByText("Conta A (fictícia)")).toBeVisible();
  await page.screenshot({
    path: path.join(pastaDeCapturas, "visao-geral.png"),
    fullPage: true,
  });

  await page.goto("/movimentos?referencia=2026-08-10");
  await expect(page.getByRole("heading", { level: 1, name: "Movimentos" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Movimentos" })).toBeVisible();
  await page.screenshot({
    path: path.join(pastaDeCapturas, "movimentos.png"),
    fullPage: true,
  });
});
