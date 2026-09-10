import { test, expect } from "@playwright/test";

test("Visão geral mostra o resumo calculado pelo finance-api de verdade", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Visão geral" })).toBeVisible();

  const contas = page.getByRole("region", { name: "Contas conectadas" });
  await expect(contas.getByText("Conta A (fictícia)")).toBeVisible();
  await expect(contas.getByText("Conta B (fictícia)")).toBeVisible();

  // Valores batendo com o que finance_api.seed grava nas contas, não mais
  // hardcoded no componente: prova de que apps/web busca o dado de verdade.
  await expect(contas.getByText("R$ 2.898,40")).toBeVisible();
  await expect(contas.getByText("R$ 254,50")).toBeVisible();

  // Indicador somando as duas contas correntes fictícias.
  const indicadores = page.getByRole("region", { name: "Indicadores" });
  await expect(indicadores.getByText("R$ 3.152,90")).toBeVisible();
  await expect(indicadores.getByText("2 contas correntes")).toBeVisible();
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

  await page.getByRole("navigation", { name: "Navegação principal" }).getByText("Visão geral").click();
  await expect(page.getByRole("heading", { level: 1, name: "Visão geral" })).toBeVisible();
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

// A decisao em si (aprovar, rejeitar, classificar) nao e' exercitada aqui de
// proposito: so' existe uma candidata na base ficticia, e o Playwright roda os
// arquivos em paralelo, entao um teste que a consumisse deixaria os outros
// instaveis. A mutacao esta coberta onde e' deterministica: nos endpoints, em
// test_main.py, e na fiacao do formulario, em cartao.test.tsx.
