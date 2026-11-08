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
  await expect(saldo.getByText("Sem cartão conectado")).toBeVisible();
  await expect(saldo.getByText("R$ 3.152,90").last()).toBeVisible();

  const ciclos = page.getByRole("region", { name: "Ciclos e pagamentos" });
  await expect(ciclos.getByText(/dia 6 de 12 do Ciclo Empresa A/)).toBeVisible();

  const contas = page.getByRole("region", { name: "Contas conectadas" });
  await expect(contas.getByText("Conta A (fictícia)")).toBeVisible();
  await expect(contas.getByText("R$ 2.898,40", { exact: true })).toBeVisible();
});

test("o ícone de informação explica o número ao tocar", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "O que é cofrinho" }).click();

  await expect(page.getByRole("tooltip")).toContainText("Sobra ou falta dos dias anteriores");
});

test("Movimentos filtra por ciclo com as datas que o finance-api calcula", async ({ page }) => {
  await page.goto("/movimentos");

  await expect(page.getByRole("heading", { level: 1, name: "Movimentos" })).toBeVisible();

  // Os ciclos vêm de GET /ciclos, não de data escrita na tela: os três têm
  // intervalo de verdade, calculado com dia útil.
  const filtros = page.getByRole("group", { name: "Filtros" });
  await filtros.getByRole("button", { name: /^Ciclo Empresa [AB], / }).click();
  const periodos = page.getByRole("dialog").getByRole("button", { name: /^Ciclo Empresa [AB] \d{2}\/\d{2} a \d{2}\/\d{2}$/ });
  await expect(periodos).toHaveCount(3);

  await expect(page.getByRole("region", { name: "Gasto por dia" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Movimentos" })).toBeVisible();
});

test("escolher outro ciclo troca o recorte pela URL", async ({ page }) => {
  await page.goto("/movimentos");

  await page.getByRole("group", { name: "Filtros" }).getByRole("button", { name: /^Ciclo Empresa [AB], / }).click();
  const seguinte = page.getByRole("dialog").getByRole("button", { name: /^Ciclo Empresa [AB] / }).last();
  const rotulo = (await seguinte.innerText()).replace(/\s+/g, " ").replace(/ (\d{2}\/\d{2})/, ", $1");
  await seguinte.click();

  await expect(page).toHaveURL(/ciclo=seguinte/);
  // O botão do período e o cabeçalho passam a descrever o ciclo escolhido.
  await expect(page.getByRole("group", { name: "Filtros" }).getByRole("button", { name: rotulo })).toBeVisible();
  await expect(page.locator("header").getByText(rotulo, { exact: false })).toBeVisible();
});

test("os contadores do Início batem com a conta feita à mão", async ({ page }) => {
  await page.goto("/");

  // Ciclo de 5 a 16 de agosto, hoje 10: 6 dias, com gasto em 7, 9 e 10.
  // Desde o primeiro movimento (10 de junho) são 62 dias e 5 com gasto; o
  // recorde vai de 11 de junho a 9 de julho. Tudo ficou dentro da cota de
  // R$ 308,20, e de 3 a 8 de julho (mesmo ciclo do mês anterior) não houve gasto.
  const contadores = page.getByRole("region", { name: "Contadores" });
  const cartao = (nome: string) => contadores.getByRole("article", { name: nome });
  await expect(cartao("Dias de ouro")).toContainText("3 de 6");
  await expect(cartao("Dias de ouro")).toContainText("57 no total");
  await expect(cartao("Sequência sem gasto")).toContainText("0 dias");
  await expect(cartao("Sequência sem gasto")).toContainText("Recorde: 29 dias");
  await expect(cartao("Dentro da cota")).toContainText("6 de 6");
  await expect(cartao("Vs Ciclo Empresa A")).toContainText("+ R$ 545,50");
});

test("filtro de categoria pelo endereço tira a cota e recorta o gasto", async ({ page }) => {
  await page.goto("/movimentos?ciclo=atual&referencia=2026-08-10&categoria=supermercado");

  const contadores = page.getByRole("region", { name: "Contadores" });
  await expect(contadores.getByRole("article", { name: "Dentro da cota" })).toContainText("Sem cota");
  await expect(page.getByRole("group", { name: "Filtros" }).getByRole("button", { name: "Supermercado" })).toBeVisible();
  // Só o mercado de 9 de agosto é supermercado no ciclo.
  await expect(page.getByRole("region", { name: "Gasto por dia" })).toContainText("Total no período: R$ 180,50");
  const porConta = page.getByRole("region", { name: "Gasto por conta no período" });
  await expect(porConta).toContainText("R$ 180,50");
  await expect(porConta.getByText(/^Cartão /)).toHaveCount(0);
});

test("o que falta classificar aparece no Início e abre a fila", async ({ page }) => {
  await page.goto("/");

  // Na base fictícia, os dois Pix recebidos não têm tradução da Pluggy.
  await page.getByRole("link", { name: "Classificar" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Para classificar" })).toBeVisible();
  const fila = page.getByRole("region", { name: "Movimentos" });
  await expect(fila.getByText("Pagamento cliente Alfa")).toBeVisible();
  await expect(fila.getByText("Pagamento cliente Beta")).toBeVisible();
  await expect(fila.getByText("Mercado")).toHaveCount(0);
});

test("a categoria na lista abre a escolha e fecha com Esc", async ({ page }) => {
  // Movimentos usa a data real; a referência leva ao ciclo da base fictícia.
  await page.goto("/movimentos?ciclo=atual&referencia=2026-08-10");

  const lista = page.getByRole("region", { name: "Movimentos" });
  await expect(lista.getByRole("button", { name: /Categoria de Mercado: Supermercado/ })).toBeVisible();
  await lista.getByRole("button", { name: /Categoria de Pagamento cliente Alfa: Para classificar/ }).click();

  const escolha = page.getByRole("dialog", { name: "Categoria de Pagamento cliente Alfa" });
  await expect(escolha.getByRole("radio", { name: "Salário e extras" })).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(escolha).toHaveCount(0);
});

test("dentro de Movimentos a barra lateral mostra as três páginas", async ({ page }) => {
  await page.goto("/movimentos/tags");

  const navegacao = page.getByRole("navigation", { name: "Navegação principal" }).first();
  await expect(navegacao.getByRole("link", { name: "Tags" })).toHaveAttribute("aria-current", "page");
  await navegacao.getByRole("link", { name: /Para classificar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Para classificar" })).toBeVisible();
  await expect(navegacao.getByRole("link", { name: "Ciclo" })).toHaveCount(0);
});

test("a navegação leva de uma tela para a outra", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("navigation", { name: "Navegação principal" }).getByText("Movimentos").click();
  await expect(page.getByRole("heading", { level: 1, name: "Movimentos" })).toBeVisible();

  await page.getByRole("navigation", { name: "Navegação principal" }).getByText("Início").click();
  await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();
});

test("o filtro acompanha a navegação, recarregar e voltar sem levar a paginação", async ({ page }) => {
  await page.goto("/movimentos?categoria=supermercado&referencia=2026-08-10&pagina=2");
  const navegacao = page.getByRole("navigation", { name: "Navegação principal" }).first();
  await navegacao.getByRole("link", { name: "Início", exact: true }).click();
  await expect(page).toHaveURL("/?categoria=supermercado&referencia=2026-08-10");
  await page.reload();
  await expect(page.getByRole("group", { name: "Filtros" }).getByRole("button", { name: "Supermercado", exact: true })).toBeVisible();
  await navegacao.getByRole("link", { name: "Movimentos", exact: true }).click();
  await expect(page).toHaveURL("/movimentos?categoria=supermercado&referencia=2026-08-10");
  await page.goBack();
  await expect(page).toHaveURL("/?categoria=supermercado&referencia=2026-08-10");
});

test("o calendário aplica o intervalo pelo endereço", async ({ page }) => {
  await page.goto("/movimentos?referencia=2026-08-10");
  await page.getByRole("group", { name: "Filtros" }).getByRole("button").first().click();
  await page.getByRole("tab", { name: "Datas", exact: true }).click();
  await page.getByRole("button", { name: "Últimos 7 dias", exact: true }).click();
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page).toHaveURL("/movimentos?de=2026-08-04&ate=2026-08-10&referencia=2026-08-10");
});

test("a moldura do calendário mantém respiro ao rolar até Aplicar", async ({ page }) => {
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto("/movimentos?referencia=2026-08-10");
      await page.getByRole("group", { name: "Filtros" }).getByRole("button").first().click();
      await page.getByRole("tab", { name: "Datas", exact: true }).click();
      await page.getByRole("button", { name: "Últimos 7 dias", exact: true }).click();
      const aplicar = page.getByRole("button", { name: "Aplicar", exact: true });
      await aplicar.evaluate((button) => {
        for (let ancestor = button.parentElement; ancestor; ancestor = ancestor.parentElement) {
          if (ancestor.scrollHeight > ancestor.clientHeight && getComputedStyle(ancestor).overflowY === "auto") {
            ancestor.scrollTop = ancestor.scrollHeight;
            break;
          }
        }
      });
      const dialog = page.getByRole("dialog");
      const touchesFrame = await dialog.evaluate((frame) => {
        const border = frame.getBoundingClientRect();
        return [...frame.querySelectorAll("button")].some((button) => {
          const box = button.getBoundingClientRect();
          const x = Math.max(border.left + 12, Math.min(box.x + box.width / 2, border.right - 12));
          return [border.top + 4, border.bottom - 4].some((y) => {
            const painted = document.elementFromPoint(x, y);
            return painted !== null && button.contains(painted);
          });
        });
      });
      expect(touchesFrame).toBe(false);
      await expect(dialog.getByRole("button", { name: "Hoje", exact: true })).toBeInViewport({ ratio: 1 });
      await expect(aplicar).toBeVisible();
      await aplicar.click();
      await expect(page).toHaveURL("/movimentos?de=2026-08-04&ate=2026-08-10&referencia=2026-08-10");
    }
  }
});

test.describe("gráficos por toque", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("as barras aguardam a hidratação antes de aceitar o primeiro toque", async ({ page }) => {
    for (const caminho of ["/", "/movimentos?referencia=2026-08-10"]) {
      let releaseScripts!: () => void;
      const scriptsReady = new Promise<void>((resolve) => {
        releaseScripts = resolve;
      });
      await page.route("**/_next/**/*.js", async (route) => {
        await scriptsReady;
        await route.continue();
      });
      try {
        await page.goto(caminho, { waitUntil: "commit" });
        const grafico = page.getByRole("region", { name: caminho === "/" ? "Gasto por dia e cota" : "Gasto por dia", exact: true });
        const dia = grafico.getByRole("button", { name: /07\/08/ });
        await expect(dia).toBeVisible();
        await expect(dia).toBeDisabled();
        const firstTap = dia.tap();
        releaseScripts();
        await firstTap;
        await expect(page.getByRole("dialog").filter({ hasText: "Maior dia do período" })).toBeVisible();
      } finally {
        releaseScripts();
        await page.unrouteAll({ behavior: "wait" });
      }
    }
  });

  test("o detalhe fica sobre a barra e a projeção abre no primeiro toque", async ({ page }) => {
    for (const caminho of ["/", "/movimentos?referencia=2026-08-10"]) {
      await page.goto(caminho);
      const grafico = page.getByRole("region", { name: caminho === "/" ? "Gasto por dia e cota" : "Gasto por dia", exact: true });
      const dia = grafico.getByRole("button", { name: /07\/08/ });
      await expect(dia.locator("span").first()).toHaveCSS("background-image", /repeating-linear-gradient/);
      const futuras = await grafico.locator("span[aria-hidden]").evaluateAll((elementos) => elementos.filter((elemento) => getComputedStyle(elemento).backgroundImage.includes("repeating-linear-gradient") && elemento.getBoundingClientRect().height > 0).length);
      expect(futuras).toBe(6);
      await dia.tap();
      const detalhe = page.getByRole("dialog").filter({ hasText: "Maior dia do período" });
      await expect(detalhe).toBeVisible();
      // Reproduz as saídas observadas depois do toque na CI.
      await dia.locator("span").first().evaluate((bar) => {
        bar.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.querySelector("header") }));
      });
      await expect(detalhe).toBeVisible();
      await dia.dispatchEvent("pointerout", { pointerType: "touch" });
      await expect(detalhe).toBeVisible();
      const barra = await dia.locator("span").first().boundingBox();
      const balao = await detalhe.boundingBox();
      expect(balao!.y + balao!.height).toBeLessThanOrEqual(barra!.y + 2);
      await dia.tap();
      await expect(detalhe).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(detalhe).not.toBeVisible();
      const projecao = grafico.getByRole("button", { name: /^Projeção do período:/ });
      await projecao.tap();
      await expect(page.getByRole("tooltip")).toContainText("No ritmo de");
      await page.keyboard.press("Escape");
      await dia.focus();
      await expect(detalhe).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(detalhe).toBeVisible();
      await grafico.getByRole("button", { name: /06\/08/ }).tap();
      await expect(detalhe).not.toBeVisible();
      await page.keyboard.press("Escape");
      await dia.hover();
      await expect(detalhe).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(detalhe).not.toBeVisible();
      await dia.dispatchEvent("pointerover", { pointerType: "pen" });
      await expect(detalhe).toBeVisible();
      await dia.dispatchEvent("pointerout", { pointerType: "pen" });
      await expect(detalhe).not.toBeVisible();
    }
  });
});

test("Recorrências mostra a fila de decisão vinda do finance-api", async ({ page }) => {
  await page.goto("/recorrencias");

  await expect(page.getByRole("heading", { level: 1, name: "Recorrências" })).toBeVisible();

  // A base fictícia tem uma assinatura cobrada em três meses seguidos, então a
  // detecção rodada pelo seed sugere exatamente uma candidata.
  await expect(page.getByRole("tab", { name: /Para decidir/ })).toHaveAttribute("aria-selected", "true");
  const fila = page.getByRole("tabpanel", { name: /Para decidir/ });
  await expect(fila.getByText("Assinatura streaming")).toBeVisible();
  await expect(fila.getByText("R$ 65,00")).toBeVisible();
  await expect(fila.getByText("3 cobranças", { exact: false })).toBeVisible();
  for (const decisao of ["Conta fixa", "Parcelamento", "Encerrada", "Não é recorrência"]) {
    await expect(fila.getByRole("button", { name: decisao })).toBeVisible();
  }
});

// A decisão em si roda em decisoes.mutavel.spec.ts, no
// projeto que só começa depois deste e restaura a base a cada tentativa.

test("o tema escolhido no painel continua depois de recarregar", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-tema", "claro");

  await page.getByRole("group", { name: "Tema" }).getByRole("button", { name: "Tema escuro" }).click();
  await expect(html).toHaveAttribute("data-tema", "escuro");

  await page.reload();
  await expect(html).toHaveAttribute("data-tema", "escuro");
});

test("a escolha de categoria do último movimento cabe na tela", async ({ page }) => {
  // Janela baixa: o último movimento fica perto da borda de baixo, onde o
  // balão antigo, posicionado à mão, passava do limite da tela.
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto("/movimentos?ciclo=atual&referencia=2026-08-10");
  const lista = page.getByRole("region", { name: "Movimentos" });
  const ultima = lista.getByRole("button", { name: /^Categoria de / }).last();
  await ultima.scrollIntoViewIfNeeded();
  await ultima.click();

  const caixa = await page.getByRole("dialog", { name: /^Categoria de / }).boundingBox();
  expect(caixa).not.toBeNull();
  expect(caixa!.y).toBeGreaterThanOrEqual(0);
  expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(640);
});

test("filtrar mantém a página onde estava", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/movimentos?ciclo=atual&referencia=2026-08-10");
  const filtros = page.getByRole("group", { name: "Filtros" });
  await filtros.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  const antes = await page.evaluate(() => window.scrollY);
  expect(antes).toBeGreaterThan(0);

  await filtros.getByRole("button", { name: "Todas as contas" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Conta A (fictícia) Conta corrente" }).click();
  await expect(page).toHaveURL(/conta=/);

  // Antes a página voltava ao topo (0). O conteúdo refeito pelo filtro pode
  // mudar alguns pixels de altura acima; o que não pode é pular.
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - antes)).toBeLessThanOrEqual(40);
});

test("o balão aberto não troca de lado ao rolar a página", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/movimentos?ciclo=atual&referencia=2026-08-10");
  // O primeiro movimento encostado no pé da tela: sem espaço embaixo, o balão abre para cima.
  const primeira = page.getByRole("region", { name: "Movimentos" }).getByRole("button", { name: /^Categoria de / }).first();
  await primeira.evaluate((botao) => botao.scrollIntoView({ block: "end" }));
  await primeira.click();
  const balao = page.getByRole("dialog", { name: /^Categoria de / });
  await expect(balao).toHaveAttribute("data-side", "top");

  // Rolar para baixo sobe o botão e abre espaço embaixo: o balão aberto não pode descer.
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(150);
  await expect(balao).toHaveAttribute("data-side", "top");
});
