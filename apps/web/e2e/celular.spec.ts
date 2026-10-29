import { expect, test } from "@playwright/test";

// Largura de um celular comum.
test.use({ viewport: { width: 390, height: 844 } });

test("no celular a navegação fica embaixo e nada passa da largura da tela", async ({ page }) => {
  for (const caminho of ["/", "/movimentos", "/movimentos/classificar", "/movimentos/tags", "/recorrencias"]) {
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

test("no celular as páginas de Movimentos viram abas", async ({ page }) => {
  await page.goto("/movimentos");

  const abas = page.getByRole("navigation", { name: "Páginas de Movimentos" });
  await abas.getByRole("link", { name: /Para classificar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Para classificar" })).toBeVisible();
  await expect(abas.getByRole("link", { name: /Para classificar/ })).toHaveAttribute("aria-current", "page");
});

test("no celular os balões de marcar vários cabem na tela", async ({ page }) => {
  await page.goto("/movimentos?ciclo=atual&referencia=2026-08-10");
  const lista = page.getByRole("region", { name: "Movimentos" });
  await lista.getByRole("button", { name: "Selecionar" }).click();
  await lista.getByRole("checkbox", { name: "Selecionar Mercado" }).check();
  const acoes = page.getByRole("region", { name: "Ações nos selecionados" });

  for (const [botao, balao] of [
    ["Marcar com tag", "Tag para 1 movimento"],
    ["Categoria", "Categoria para 1 movimento"],
  ]) {
    await acoes.getByRole("button", { name: botao }).click();
    const caixa = await page.getByRole("dialog", { name: balao }).boundingBox();
    expect(caixa).not.toBeNull();
    expect(caixa!.x).toBeGreaterThanOrEqual(0);
    expect(caixa!.y).toBeGreaterThanOrEqual(0);
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(390);
    expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(844);
    await page.keyboard.press("Escape");
  }
});
