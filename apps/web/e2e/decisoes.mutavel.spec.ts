import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const RAIZ = path.resolve(__dirname, "../../..");
const API = "http://127.0.0.1:8100";

/** Volta a base de teste ao extrato fictício. Recusa qualquer banco que não
 *  seja o de teste local: a validação fica no próprio seed. */
function restaurarBaseFicticia() {
  execFileSync(
    "uv",
    [
      "run",
      "--package",
      "finance-api",
      "python",
      "-m",
      "finance_api.seed",
      "--reset-test",
    ],
    {
      cwd: RAIZ,
      env: {
        ...process.env,
        DATABASE_URL:
          "postgresql+asyncpg://mercurio:mercurio@127.0.0.1:5432/mercurio_test",
      },
      stdio: "ignore",
    },
  );
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

  const [gravada] = await (
    await request.get(`${API}/recorrencias?status=parcelamento`)
  ).json();
  // Três parcelas depois da última cobrança vista, mês a mês.
  const ultima = new Date(`${gravada.ultima_data}T00:00:00`);
  const esperado = new Date(
    ultima.getFullYear(),
    ultima.getMonth() + 3,
    ultima.getDate(),
  );
  expect(gravada.fim_previsto).toBe(
    `${esperado.getFullYear()}-${String(esperado.getMonth() + 1).padStart(2, "0")}-${String(esperado.getDate()).padStart(2, "0")}`,
  );
});

test("renomear a conta vale depois de recarregar e volta ao nome do banco", async ({
  page,
}) => {
  await page.goto("/");
  const contas = page.getByRole("region", { name: "Contas conectadas" });

  await contas
    .getByRole("button", { name: "Renomear Conta A (fictícia)" })
    .click();
  await contas.getByLabel("Apelido da conta").fill("Conta principal");
  await contas.getByRole("button", { name: "Salvar" }).click();
  await expect(contas.getByText("Conta principal")).toBeVisible();

  await page.reload();
  await expect(contas.getByText("Conta principal")).toBeVisible();

  await contas
    .getByRole("button", { name: "Renomear Conta principal" })
    .click();
  await contas
    .getByRole("button", {
      name: "Voltar ao nome do banco: Conta A (fictícia)",
    })
    .click();
  await expect(contas.getByText("Conta A (fictícia)")).toBeVisible();
  await expect(contas.getByText("Conta principal")).toHaveCount(0);
});

test("classificar para todos grava a categoria na API e tira da fila", async ({
  page,
  request,
}) => {
  await page.goto("/movimentos/classificar");
  const fila = page.getByRole("region", { name: "Movimentos" });

  await fila
    .getByRole("button", { name: /Categoria de Pagamento cliente Alfa/ })
    .click();
  const escolha = page.getByRole("dialog", {
    name: "Categoria de Pagamento cliente Alfa",
  });
  await escolha.getByText("Salário e extras").click();
  await escolha.getByRole("button", { name: "Salvar" }).click();

  await expect(fila.getByText("Pagamento cliente Alfa")).toHaveCount(0);
  await expect(fila.getByText("Pagamento cliente Beta")).toBeVisible();
  const movimentos = await (await request.get(`${API}/movimentos`)).json();
  const alfa = movimentos.find(
    (movimento: { descricao: string }) =>
      movimento.descricao === "Pagamento cliente Alfa",
  );
  expect(alfa).toMatchObject({
    categoria_propria: "salario-e-extras",
    origem_da_categoria: "dono",
  });
  expect(
    await (
      await request.get(`${API}/movimentos/para-classificar?hoje=2026-08-10`)
    ).json(),
  ).toEqual({ total: 1 });
});

test("marcar dois com uma tag grava na API e o filtro mostra o total", async ({
  page,
  request,
}) => {
  await page.goto("/movimentos?ciclo=atual&referencia=2026-08-10");
  const lista = page.getByRole("region", { name: "Movimentos" });

  await lista.getByRole("checkbox", { name: "Selecionar Mercado" }).check();
  await lista
    .getByRole("checkbox", { name: "Selecionar Ferramenta de trabalho" })
    .check();
  const acoes = page.getByRole("region", { name: "Ações nos selecionados" });
  await acoes.getByRole("button", { name: "Marcar com tag" }).click();
  const balao = page.getByRole("dialog", { name: "Tag para 2 movimentos" });
  await balao.getByLabel("Buscar ou criar tag").fill("viagem Exemplo");
  await balao.getByRole("button", { name: 'Criar "viagem Exemplo"' }).click();
  await balao.getByRole("button", { name: "Aplicar" }).click();
  await expect(acoes).toHaveCount(0);

  const [tag] = await (await request.get(`${API}/tags`)).json();
  expect(tag).toMatchObject({
    nome: "viagem Exemplo",
    gasto: "480.50",
    quantidade: 2,
  });

  await page.goto("/movimentos/tags");
  await page
    .getByRole("region", { name: "Suas tags" })
    .getByRole("link", { name: "viagem Exemplo" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "viagem Exemplo" }),
  ).toBeVisible();
  await expect(page.getByText("R$ 480,50").first()).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Por categoria" })
      .getByText("Supermercado"),
  ).toBeVisible();
  // Gastos na sexta e no domingo, com o sábado vazio no meio.
  const leitura = page.getByRole("region", { name: "Leitura" });
  await expect(leitura).toContainText("Fim de semana pesou");
  await expect(leitura).toContainText("1 de 3");

  // A tag aberta só existe depois de marcar, então a largura do celular é conferida aqui.
  await page.setViewportSize({ width: 390, height: 844 });
  const largura = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(largura).toBeLessThanOrEqual(390);
});

test("criar tag com teto pela tela grava na API e o cartão mostra quanto falta", async ({
  page,
  request,
}) => {
  await page.goto("/movimentos/tags");
  await page.getByRole("button", { name: "Nova tag" }).click();
  const janela = page.getByRole("dialog", { name: "Nova tag" });
  await janela.getByRole("textbox").fill("viagem Planejada");
  await janela.getByRole("button", { name: /3\.000/ }).click();
  await janela.getByRole("button", { name: "Criar tag" }).click();
  await expect(janela).toHaveCount(0);

  const [tag] = await (await request.get(`${API}/tags`)).json();
  expect(tag).toMatchObject({
    nome: "viagem Planejada",
    teto: "3000.00",
    quantidade: 0,
  });
  await expect(page.getByRole("region", { name: "Suas tags" })).toContainText(
    "Faltam R$ 3.000,00 de R$ 3.000,00",
  );
});
