import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Só as regras ligadas a critérios WCAG A e AA: as de "boa prática" do axe
// não são requisito e virariam ruído. A checagem automática não pega tudo.
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function violacoes(page: import("@playwright/test").Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return violations.map(({ id, nodes }) => ({ id, alvos: nodes.map((node) => node.target) }));
}

for (const tela of ["/", "/movimentos", "/recorrencias"]) {
  test(`${tela} sem violação automática de WCAG A e AA`, async ({ page }) => {
    await page.goto(tela);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(await violacoes(page)).toEqual([]);
  });
}

test("formulário de renomear aberto sem violação automática", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Renomear Conta A (fictícia)" }).click();
  await expect(page.getByLabel("Apelido da conta")).toBeFocused();

  expect(await violacoes(page)).toEqual([]);
});
