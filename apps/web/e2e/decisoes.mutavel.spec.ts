import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const RAIZ = path.resolve(__dirname, "../../..");
const API = "http://127.0.0.1:8100";

/** Volta a base de teste ao extrato fictício. Recusa qualquer banco que não
 *  seja o de teste local: a validação fica no próprio seed. */
function restaurarBaseFicticia() {
  execFileSync("uv", ["run", "--package", "finance-api", "python", "-m", "finance_api.seed", "--reset-test"], {
    cwd: RAIZ,
    env: {
      ...process.env,
      DATABASE_URL: "postgresql+asyncpg://mercurio:mercurio@127.0.0.1:5432/mercurio_test",
    },
    stdio: "ignore",
  });
}

test.beforeEach(() => {
  restaurarBaseFicticia();
});

test.afterAll(() => {
  restaurarBaseFicticia();
});

test("aprovar já classificando grava na API e tira a candidata da fila", async ({
  page,
  request,
}) => {
  await page.goto("/recorrencias");
  const fila = page.getByRole("region", { name: "Esperando decisão" });
  await fila.getByLabel("Categoria").selectOption("assinatura");

  await fila.getByRole("button", { name: "Aprovar" }).click();

  await expect(fila.getByText("Nenhuma candidata esperando", { exact: false })).toBeVisible();
  const decididas = page.getByRole("region", { name: "Já decididas" });
  await expect(decididas.getByText("Assinatura streaming")).toBeVisible();
  await expect(decididas.getByRole("button", { name: "Rejeitar" })).toBeVisible();

  const aprovadas = await (await request.get(`${API}/recorrencias?status=aprovada`)).json();
  expect(aprovadas).toEqual([
    expect.objectContaining({ descricao: "Assinatura streaming", categoria: "assinatura" }),
  ]);
});

test("renomear a conta vale depois de recarregar e volta ao nome do banco", async ({ page }) => {
  await page.goto("/");
  const contas = page.getByRole("region", { name: "Contas conectadas" });

  await contas.getByRole("button", { name: "Renomear Conta A (fictícia)" }).click();
  await contas.getByLabel("Apelido da conta").fill("Conta principal");
  await contas.getByRole("button", { name: "Salvar" }).click();
  await expect(contas.getByText("Conta principal")).toBeVisible();

  await page.reload();
  await expect(contas.getByText("Conta principal")).toBeVisible();

  await contas.getByRole("button", { name: "Renomear Conta principal" }).click();
  await contas.getByRole("button", { name: "Voltar ao nome do banco: Conta A (fictícia)" }).click();
  await expect(contas.getByText("Conta A (fictícia)")).toBeVisible();
  await expect(contas.getByText("Conta principal")).toHaveCount(0);
});
