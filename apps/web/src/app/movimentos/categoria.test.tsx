import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { Categoria, Movimento } from "../buscar-movimentos";
import { CategoriaDoMovimento } from "./categoria";

const acoes = vi.hoisted(() => ({
  classificarMovimento: vi.fn(),
  definirTags: vi.fn(),
  criarCategoria: vi.fn(),
}));
vi.mock("../acoes", () => acoes);

const CATEGORIAS: Categoria[] = [
  {
    id: "alimentacao",
    nome: "Alimentação",
    icone: "Utensils",
    cor: 45,
    tipo: "despesa",
  },
  {
    id: "supermercado",
    nome: "Supermercado",
    icone: "ShoppingCart",
    cor: 140,
    tipo: "despesa",
  },
  { id: "viagem", nome: "Viagem", icone: "Plane", cor: 220, tipo: "despesa" },
  { id: "vendas", nome: "Vendas", icone: "Store", cor: 60, tipo: "receita" },
];

function movimento(campos: Partial<Movimento>): Movimento {
  return {
    id: 7,
    contaId: "c1",
    data: "2026-10-11",
    valor: 95,
    descricao: "Transferência enviada|Pessoa A",
    tipo: "despesa",
    categoria: "Transfers",
    duplicadoPossivel: false,
    pagamentoDeFatura: null,
    categoriaPropria: null,
    origemDaCategoria: null,
    historico: [],
    tags: [],
    ...campos,
  };
}

function abrir(campos: Partial<Movimento> = {}, tagsExistentes: string[] = []) {
  render(
    <CategoriaDoMovimento
      movimento={movimento(campos)}
      categorias={CATEGORIAS}
      tagsExistentes={tagsExistentes}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Categoria de Pessoa A/ }),
  );
  return screen.getByRole("dialog", { name: "Categoria de Pessoa A" });
}

beforeEach(() => {
  for (const acao of Object.values(acoes)) {
    acao.mockReset();
    acao.mockResolvedValue({ erro: null, id: null });
  }
});

test("sem categoria aparece para classificar, e transferência própria não mostra nada", () => {
  const { container } = render(
    <>
      <CategoriaDoMovimento movimento={movimento({})} categorias={CATEGORIAS} />
      <CategoriaDoMovimento
        movimento={movimento({ id: 8, tipo: "aporte_titular" })}
        categorias={CATEGORIAS}
      />
    </>,
  );

  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(container.textContent).toBe("Para classificar");
});

test("as categorias que o destinatário já teve vêm primeiro e a escolha começa em só este", () => {
  const escolha = abrir({
    historico: [
      { categoria: "viagem", vezes: 3 },
      { categoria: "alimentacao", vezes: 1 },
    ],
  });

  const opcoes = within(escolha)
    .getAllByRole("radio")
    .filter((opcao) => (opcao as HTMLInputElement).name === "categoria")
    .map((opcao) => (opcao as HTMLInputElement).value);
  expect(opcoes).toEqual(["viagem", "alimentacao", "supermercado"]);
  expect(within(escolha).getByText("3 vezes")).toBeTruthy();
  expect(
    within(escolha).getByRole("radio", { name: "Só este" }),
  ).toHaveProperty("checked", true);
});

test("a busca filtra sem acento e oferece criar quando não acha", () => {
  const escolha = abrir();

  fireEvent.change(within(escolha).getByLabelText("Buscar categoria"), {
    target: { value: "alimentacao" },
  });
  expect(
    within(escolha).getAllByRole("radio", {
      name: /Alimentação|Supermercado|Viagem/,
    }),
  ).toHaveLength(1);

  fireEvent.change(within(escolha).getByLabelText("Buscar categoria"), {
    target: { value: "Pet" },
  });
  expect(
    within(escolha).getByRole("button", { name: 'Criar "Pet"' }),
  ).toBeTruthy();
});

test("salvar manda categoria e alcance só este por padrão, e a falha fica na tela", async () => {
  acoes.classificarMovimento.mockResolvedValue({
    erro: "Não foi possível salvar a categoria: a API não respondeu.",
  });
  const escolha = abrir();

  fireEvent.click(within(escolha).getByRole("radio", { name: "Viagem" }));
  fireEvent.click(within(escolha).getByRole("button", { name: "Salvar" }));

  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toMatch(/API não respondeu/),
  );
  const enviado = acoes.classificarMovimento.mock.calls[0][0] as FormData;
  expect(Object.fromEntries(enviado)).toEqual({
    movimento_id: "7",
    categoria: "viagem",
    alcance: "este",
  });
  expect(acoes.definirTags).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("só mudar as tags não reclassifica, e a tag existente é sugerida", async () => {
  const escolha = abrir({ categoriaPropria: "viagem" }, ["viagem Exemplo"]);
  const campo = within(escolha).getByLabelText("Adicionar tag");

  fireEvent.change(campo, { target: { value: "viagem ex" } });
  fireEvent.click(
    within(escolha).getByRole("button", { name: /viagem Exemplo/ }),
  );
  fireEvent.change(campo, { target: { value: "hospedagem" } });
  fireEvent.keyDown(campo, { key: "Enter" });
  fireEvent.click(within(escolha).getByRole("button", { name: "Salvar" }));

  await waitFor(() =>
    expect(acoes.definirTags).toHaveBeenCalledWith(7, [
      "viagem Exemplo",
      "hospedagem",
    ]),
  );
  expect(acoes.classificarMovimento).not.toHaveBeenCalled();
});

test("criar categoria usa o nome buscado e já deixa ela escolhida", async () => {
  acoes.criarCategoria.mockResolvedValue({ erro: null, id: "pet" });
  const escolha = abrir();

  fireEvent.change(within(escolha).getByLabelText("Buscar categoria"), {
    target: { value: "Pet" },
  });
  fireEvent.click(within(escolha).getByRole("button", { name: 'Criar "Pet"' }));
  fireEvent.click(within(escolha).getByRole("radio", { name: "Cor 200" }));
  fireEvent.click(
    within(escolha).getByRole("button", { name: "Criar e usar" }),
  );

  await waitFor(() =>
    expect(acoes.criarCategoria).toHaveBeenCalledWith({
      nome: "Pet",
      icone: "Dog",
      cor: 200,
      tipo: "despesa",
    }),
  );
  await waitFor(() =>
    expect(
      within(escolha).getByRole("button", { name: "Salvar" }),
    ).toHaveProperty("disabled", false),
  );
});

// Receita, reembolso e celular. Ver docs/specs/2026-11-13-categorias-de-receita-e-reembolso.md.

const PIX_RECEBIDO = {
  descricao: "Transferência recebida|Pessoa A",
  tipo: "receita",
};

test("despesa não oferece categoria de entrada", () => {
  const escolha = abrir();

  expect(within(escolha).queryByRole("radio", { name: "Vendas" })).toBeNull();
  expect(within(escolha).getByRole("radio", { name: "Viagem" })).toBeTruthy();
});

test.each([false, true])(
  "histórico de uma despesa respeita o tipo da categoria, celular=%s",
  (celular) => {
    globalThis.telaDeCelularDeTeste = celular;
    const escolha = abrir({
      historico: [
        { categoria: "vendas", vezes: 3 },
        { categoria: "viagem", vezes: 1 },
      ],
    });

    expect(within(escolha).queryByRole("radio", { name: /Vendas/ })).toBeNull();
    expect(within(escolha).getByRole("radio", { name: /Viagem/ })).toBeTruthy();
    expect(within(escolha).getAllByRole("radio", { name: /Viagem/ })).toHaveLength(1);
  },
);

test.each([false, true])(
  "receita com histórico mantém as categorias nos grupos, celular=%s",
  (celular) => {
    globalThis.telaDeCelularDeTeste = celular;
    const escolha = abrir({
      ...PIX_RECEBIDO,
      historico: [
        { categoria: "viagem", vezes: 3 },
        { categoria: "vendas", vezes: 1 },
      ],
    });

    const lista = within(escolha).getByRole("radiogroup", { name: "Categoria" });
    const radios = within(lista).getAllByRole("radio");
    expect(radios[0].closest("label")?.textContent).toContain("Vendas");
    expect(within(lista).queryByText(/Já usadas para/)).toBeNull();
    expect(within(lista).getAllByRole("radio", { name: /Viagem/ })).toHaveLength(1);
    expect(within(lista).getAllByRole("radio", { name: /Vendas/ })).toHaveLength(1);
    const texto = lista.textContent ?? "";
    expect(texto.indexOf("Entradas")).toBeLessThan(texto.indexOf("Vendas"));
    expect(texto.indexOf("Devolveu um gasto")).toBeLessThan(texto.indexOf("Viagem"));
  },
);

test("receita mostra as entradas e, depois, as de despesa como devolução", () => {
  const escolha = abrir(PIX_RECEBIDO);

  expect(within(escolha).getByText("Entradas")).toBeTruthy();
  expect(within(escolha).getByText("Devolveu um gasto")).toBeTruthy();
  // Uma explicação só, no grupo, e não repetida em cada categoria.
  expect(within(escolha).getAllByText(/não conta como renda/)).toHaveLength(1);
  expect(within(escolha).getByRole("radio", { name: "Vendas" })).toBeTruthy();
  expect(within(escolha).getByRole("radio", { name: "Viagem" })).toBeTruthy();
});

test("reembolso vale só para o movimento: some o 'Vale para' e vai só este", async () => {
  const escolha = abrir(PIX_RECEBIDO);

  fireEvent.click(within(escolha).getByRole("radio", { name: "Viagem" }));

  expect(within(escolha).queryByText("Vale para")).toBeNull();
  expect(
    within(escolha).getByText("Vale só para este movimento."),
  ).toBeTruthy();
  fireEvent.click(within(escolha).getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(acoes.classificarMovimento).toHaveBeenCalled());
  const enviado = acoes.classificarMovimento.mock.calls[0][0] as FormData;
  expect(enviado.get("alcance")).toBe("este");
});

test("entrada em receita mantém o 'Vale para'", () => {
  const escolha = abrir(PIX_RECEBIDO);

  fireEvent.click(within(escolha).getByRole("radio", { name: "Vendas" }));

  expect(within(escolha).getByText("Vale para")).toBeTruthy();
});

test("no celular a escolha abre em tela cheia, com botão de fechar", () => {
  globalThis.telaDeCelularDeTeste = true;
  const escolha = abrir();

  expect(escolha.className).toMatch(/fixed inset-0/);
  fireEvent.click(within(escolha).getByRole("button", { name: "Fechar" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("receita marcada numa categoria de despesa aparece como devolução", () => {
  render(
    <CategoriaDoMovimento
      movimento={movimento({
        ...PIX_RECEBIDO,
        categoriaPropria: "viagem",
        origemDaCategoria: "dono",
      })}
      categorias={CATEGORIAS}
    />,
  );

  expect(screen.getByText("Devolveu")).toBeTruthy();
});

test("receita numa categoria de entrada não leva a etiqueta", () => {
  render(
    <CategoriaDoMovimento
      movimento={movimento({
        ...PIX_RECEBIDO,
        categoriaPropria: "vendas",
        origemDaCategoria: "dono",
      })}
      categorias={CATEGORIAS}
    />,
  );

  expect(screen.queryByText("Devolveu")).toBeNull();
});
