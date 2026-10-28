import { expect, test } from "@playwright/test";

// Largura de um celular comum.
test.use({ viewport: { width: 390, height: 844 } });

test("no celular a navegação fica embaixo e nada passa da largura da tela", async ({ page }) => {
  for (const caminho of ["/", "/movimentos", "/recorrencias"]) {
    await page.goto(caminho);
    const navegacao = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(navegacao).toHaveCount(1);
    const caixa = await navegacao.boundingBox();
    expect(caixa!.y + caixa!.height).toBeGreaterThanOrEqual(844 - 1);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura, caminho).toBeLessThanOrEqual(390);
  }
});

test("o formulário de renomear cabe na largura do celular", async ({ page }) => {
  await page.goto("/");
  const contas = page.getByRole("region", { name: "Contas conectadas" });
  await contas.getByRole("button", { name: "Renomear Conta A (fictícia)" }).click({ timeout: 5_000 });

  const formulario = contas.getByRole("form", { name: "Renomear Conta A (fictícia)" });
  await expect(formulario).toBeVisible();
  for (const controle of [
    formulario.getByLabel("Apelido da conta"),
    formulario.getByRole("button", { name: "Salvar" }),
    formulario.getByRole("button", { name: "Cancelar" }),
  ]) {
    const caixa = await controle.boundingBox();
    expect(caixa).not.toBeNull();
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(390);
  }
});
