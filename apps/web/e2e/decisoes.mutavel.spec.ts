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

test("decidir como parcelamento grava o fim na API e muda a candidata de aba", async ({
  page,
  request,
}) => {
  await page.goto("/recorrencias");
  const fila = page.getByRole("tabpanel", { name: /Para decidir/ });

  await fila.getByRole("button", { name: "Parcelamento" }).click();
  await fila.getByLabel("Parcelas que faltam").fill("3");
  await fila.getByRole("button", { name: "Confirmar" }).click();

  await expect(fila.getByText("Nada esperando decisão.")).toBeVisible();
  await page.getByRole("tab", { name: /Parcelamentos/ }).click();
  const parcelamentos = page.getByRole("tabpanel", { name: /Parcelamentos/ });
  await expect(parcelamentos.getByText("Assinatura streaming")).toBeVisible();
  await expect(parcelamentos.getByText("3 de 6 pagas")).toBeVisible();

  const [gravada] = await (await request.get(`${API}/recorrencias?status=parcelamento`)).json();
  // Três parcelas depois da última cobrança vista, mês a mês.
  const ultima = new Date(`${gravada.ultima_data}T00:00:00`);
  const esperado = new Date(ultima.getFullYear(), ultima.getMonth() + 3, ultima.getDate());
  expect(gravada.fim_previsto).toBe(
    `${esperado.getFullYear()}-${String(esperado.getMonth() + 1).padStart(2, "0")}-${String(esperado.getDate()).padStart(2, "0")}`,
  );
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
