import { test, expect } from "@playwright/test";

test("Início mostra o dinheiro livre calculado pelo finance-api de verdade", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();

  // Conta da base fictícia no dia que MERCURIO_HOJE fixa: livre de R$ 3.152,90
  // nas duas contas e R$ 545,50 de gasto no ciclo, R$ 65,00 deles hoje; cota
  // (3.152,90 + 545,50) / 12 = 308,20; cofrinho 5 x 308,20 - 480,50.
  const hoje = page.getByRole("region", { name: "Hoje dá para gastar" });
  await expect(hoje.getByText("R$ 1.303,70")).toBeVisible();
  await expect(hoje.getByText("R$ 308,20")).toBeVisible();
  await expect(hoje.getByText("+ R$ 1.060,50")).toBeVisible();

  const saldo = page.getByRole("region", { name: "Saldo nas contas" });
  await expect(saldo.getByText("sem cartão conectado")).toBeVisible();
  await expect(saldo.getByText("R$ 3.152,90").last()).toBeVisible();

  const ciclos = page.getByRole("region", { name: "Ciclos e pagamentos" });
  await expect(ciclos.getByText(/dia 6 de 12 do Ciclo Empresa A/)).toBeVisible();

  const contas = page.getByRole("region", { name: "Contas conectadas" });
  await expect(contas.getByText("Conta A (fictícia)")).toBeVisible();
  await expect(contas.getByText("R$ 2.898,40")).toBeVisible();
});

test("o ícone de informação explica o número ao tocar", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "O que é cofrinho" }).click();

  await expect(page.getByRole("tooltip")).toContainText("O que sobrou ou faltou das cotas");
});

test("Movimentos filtra por ciclo com as datas que o finance-api calcula", async ({ page }) => {
  await page.goto("/movimentos");

  await expect(page.getByRole("heading", { level: 1, name: "Movimentos" })).toBeVisible();

  // O filtro de ciclo vem de GET /ciclos, não de data escrita na tela: os
  // três ciclos têm intervalo de verdade, calculado com dia útil.
  const filtroDeCiclo = page.getByRole("navigation", { name: "Ciclo" });
  await expect(filtroDeCiclo.getByRole("link")).toHaveCount(3);
  // Formato "Ciclo N · DD/MM a DD/MM".
  for (const rotulo of await filtroDeCiclo.getByRole("link").allInnerTexts()) {
    expect(rotulo).toMatch(/^Ciclo [12] · \d{2}\/\d{2} a \d{2}\/\d{2}$/);
  }

  await expect(page.getByRole("region", { name: "Gasto por dia" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Movimentos" })).toBeVisible();
});

test("escolher outro ciclo troca o recorte pela URL", async ({ page }) => {
  await page.goto("/movimentos");

  const seguinte = page.getByRole("navigation", { name: "Ciclo" }).getByRole("link").last();
  const rotulo = await seguinte.innerText();
  await seguinte.click();

  await expect(page).toHaveURL(/ciclo=seguinte/);
  await expect(seguinte).toHaveAttribute("aria-current", "true");

  // O cabeçalho passa a descrever o mesmo intervalo do filtro escolhido.
  const [, inicio, fim] = rotulo.match(/(\d{2}\/\d{2}) a (\d{2}\/\d{2})/) ?? [];
  await expect(page.getByText(`de ${inicio} a ${fim}`, { exact: false })).toBeVisible();
});

test("a navegação leva de uma tela para a outra", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("navigation", { name: "Navegação principal" }).getByText("Movimentos").click();
  await expect(page.getByRole("heading", { level: 1, name: "Movimentos" })).toBeVisible();

  await page.getByRole("navigation", { name: "Navegação principal" }).getByText("Início").click();
  await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();
});

test("Recorrências mostra a fila de decisão vinda do finance-api", async ({ page }) => {
  await page.goto("/recorrencias");

  await expect(page.getByRole("heading", { level: 1, name: "Recorrências" })).toBeVisible();

  // A base fictícia tem uma assinatura cobrada em tres meses seguidos, entao a
  // deteccao rodada pelo seed sugere exatamente uma candidata.
  const fila = page.getByRole("region", { name: "Esperando decisão" });
  await expect(fila.getByText("Assinatura streaming")).toBeVisible();
  await expect(fila.getByText("R$ 65,00")).toBeVisible();
  await expect(fila.getByText("3 cobranças", { exact: false })).toBeVisible();
  await expect(fila.getByRole("button", { name: "Aprovar" })).toBeVisible();
  await expect(fila.getByRole("button", { name: "Rejeitar" })).toBeVisible();
  await expect(fila.getByLabel("Categoria")).toHaveValue("");
});

// A decisão em si (aprovar, classificar) roda em decisoes.mutavel.spec.ts, no
// projeto que só começa depois deste e restaura a base a cada tentativa.
