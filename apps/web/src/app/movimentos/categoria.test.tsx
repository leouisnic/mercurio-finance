import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  { id: "alimentacao", nome: "Alimentação", icone: "Utensils", cor: 45 },
  { id: "supermercado", nome: "Supermercado", icone: "ShoppingCart", cor: 140 },
  { id: "viagem", nome: "Viagem", icone: "Plane", cor: 220 },
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
  render(<CategoriaDoMovimento movimento={movimento(campos)} categorias={CATEGORIAS} tagsExistentes={tagsExistentes} />);
  fireEvent.click(screen.getByRole("button", { name: /Categoria de Pessoa A/ }));
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
      <CategoriaDoMovimento movimento={movimento({ id: 8, tipo: "aporte_titular" })} categorias={CATEGORIAS} />
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
  expect(within(escolha).getByRole("radio", { name: "Só este" })).toHaveProperty("checked", true);
});

test("a busca filtra sem acento e oferece criar quando não acha", () => {
  const escolha = abrir();

  fireEvent.change(within(escolha).getByLabelText("Buscar categoria"), { target: { value: "alimentacao" } });
  expect(within(escolha).getAllByRole("radio", { name: /Alimentação|Supermercado|Viagem/ })).toHaveLength(1);

  fireEvent.change(within(escolha).getByLabelText("Buscar categoria"), { target: { value: "Pet" } });
  expect(within(escolha).getByRole("button", { name: 'Criar "Pet"' })).toBeTruthy();
});

test("salvar manda categoria e alcance só este por padrão, e a falha fica na tela", async () => {
  acoes.classificarMovimento.mockResolvedValue({ erro: "Não foi possível salvar a categoria: a API não respondeu." });
  const escolha = abrir();

  fireEvent.click(within(escolha).getByRole("radio", { name: "Viagem" }));
  fireEvent.click(within(escolha).getByRole("button", { name: "Salvar" }));

  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/API não respondeu/));
  const enviado = acoes.classificarMovimento.mock.calls[0][0] as FormData;
  expect(Object.fromEntries(enviado)).toEqual({ movimento_id: "7", categoria: "viagem", alcance: "este" });
  expect(acoes.definirTags).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("só mudar as tags não reclassifica, e a tag existente é sugerida", async () => {
  const escolha = abrir({ categoriaPropria: "viagem" }, ["viagem Exemplo"]);
  const campo = within(escolha).getByLabelText("Adicionar tag");

  fireEvent.change(campo, { target: { value: "viagem ex" } });
  fireEvent.click(within(escolha).getByRole("button", { name: /viagem Exemplo/ }));
  fireEvent.change(campo, { target: { value: "hospedagem" } });
  fireEvent.keyDown(campo, { key: "Enter" });
  fireEvent.click(within(escolha).getByRole("button", { name: "Salvar" }));

  await waitFor(() => expect(acoes.definirTags).toHaveBeenCalledWith(7, ["viagem Exemplo", "hospedagem"]));
  expect(acoes.classificarMovimento).not.toHaveBeenCalled();
});

test("criar categoria usa o nome buscado e já deixa ela escolhida", async () => {
  acoes.criarCategoria.mockResolvedValue({ erro: null, id: "pet" });
  const escolha = abrir();

  fireEvent.change(within(escolha).getByLabelText("Buscar categoria"), { target: { value: "Pet" } });
  fireEvent.click(within(escolha).getByRole("button", { name: 'Criar "Pet"' }));
  fireEvent.click(within(escolha).getByRole("radio", { name: "Cor 200" }));
  fireEvent.click(within(escolha).getByRole("button", { name: "Criar e usar" }));

  await waitFor(() => expect(acoes.criarCategoria).toHaveBeenCalledWith({ nome: "Pet", icone: "Dog", cor: 200 }));
  await waitFor(() => expect(within(escolha).getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", false));
});
