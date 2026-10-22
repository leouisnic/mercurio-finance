import { expect, test } from "@playwright/test";

// Largura de um celular comum. O layout inteiro das telas fica para a
// identidade visual; aqui só o que esta leva acrescentou precisa caber.
test.use({ viewport: { width: 390, height: 844 } });

test("o formulário de renomear cabe na largura do celular", async ({ page }) => {
  // Falha conhecida: a barra lateral tem largura fixa de 232 px e, em 390 px,
  // o conteúdo fica com 110 px, onde nenhum card cabe. Quando a navegação do
  // celular existir, este teste passa a acusar e a marca precisa sair.
  test.fail();
  await page.goto("/");
  const contas = page.getByRole("region", { name: "Contas conectadas" });
  // Prazo próprio: estouro do prazo do teste não conta como a falha esperada.
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
