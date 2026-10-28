import { expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { marcarVarios } = vi.hoisted(() => ({ marcarVarios: vi.fn() }));
vi.mock("../acoes", () => ({ marcarVarios }));
import { Lista } from "./lista";
import type { Movimento } from "../buscar-movimentos";
import type { Conta } from "../buscar-resumo";

const CONTAS: Conta[] = [
  {
    id: "c1",
    nome: "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)",
    apelido: null,
    tipo: "BANK",
    saldo: 6.09,
    limite: null,
    disponivel: null,
    bandeira: null,
    final: null,
    itemId: null,
    fechamento: null,
    vencimento: null,
  },
];

function movimento(campos: Partial<Movimento>): Movimento {
  return {
    id: 1,
    contaId: "c1",
    data: "2026-09-04",
    valor: 100,
    descricao: "Mercado",
    tipo: "despesa",
    categoria: null,
    duplicadoPossivel: false,
    pagamentoDeFatura: null,
    categoriaPropria: null,
    origemDaCategoria: null,
    historico: [],
    tags: [],
    ...campos,
  };
}

test("despesa sai em laranja com sinal de menos, receita em verde com mais", () => {
  render(
    <Lista
      movimentos={[
        movimento({ id: 1, tipo: "despesa", valor: 65 }),
        movimento({ id: 2, tipo: "receita", valor: 2500, descricao: "Pagamento recebido" }),
      ]}
      contas={CONTAS}
    />,
  );

  expect(screen.getByText("- R$ 65,00").className).toContain("gasto");
  expect(screen.getByText("+ R$ 2.500,00").className).toContain("positivo");
});

test("transferência própria não ganha sinal nem cor de gasto", () => {
  render(
    <Lista
      movimentos={[movimento({ tipo: "aporte_titular", valor: 340.04, descricao: "Pagamento recebido" })]}
      contas={CONTAS}
    />,
  );

  const valor = screen.getByText("R$ 340,04");
  expect(valor.className).toContain("tinta-3");
  expect(valor.textContent).not.toContain("-");
});

test("pagamento de fatura avisa que está fora das somas de gasto", () => {
  render(
    <Lista
      movimentos={[movimento({ pagamentoDeFatura: "detectado", descricao: "Pagamento de fatura" })]}
      contas={CONTAS}
    />,
  );

  expect(screen.getByText(/fora das somas de gasto/)).toBeDefined();
});

test("pagamento de fatura descartado volta a ser gasto comum, sem aviso", () => {
  render(
    <Lista movimentos={[movimento({ pagamentoDeFatura: "descartado" })]} contas={CONTAS} />,
  );

  expect(screen.queryByText(/fora das somas de gasto/)).toBeNull();
});

test("possível duplicidade informa que o valor continua no total", () => {
  render(<Lista movimentos={[movimento({ duplicadoPossivel: true })]} contas={CONTAS} />);

  expect(screen.getByText(/possível duplicidade/)).toBeDefined();
});

test("a conta aparece com o nome do banco, não com o nome cru da Pluggy", () => {
  render(<Lista movimentos={[movimento({})]} contas={CONTAS} />);

  expect(screen.getByText("Conta Nubank")).toBeDefined();
});

test("recorte sem movimento diz isso em vez de mostrar tabela vazia", () => {
  render(<Lista movimentos={[]} contas={CONTAS} />);

  expect(screen.getByText("Nenhum movimento neste recorte.")).toBeDefined();
});

test("marcar dois e aplicar uma tag manda os dois para a API e limpa a seleção", async () => {
  marcarVarios.mockResolvedValue({ erro: null });
  render(
    <Lista
      movimentos={[movimento({ id: 1, descricao: "Pousada" }), movimento({ id: 2, descricao: "Restaurante" })]}
      contas={CONTAS}
      tagsExistentes={["viagem Exemplo"]}
    />,
  );

  fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Pousada" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Restaurante" }));
  expect(screen.getByText("2 selecionados")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Marcar com tag" }));
  fireEvent.change(screen.getByLabelText("Nome da tag"), { target: { value: "viagem Exemplo" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

  await waitFor(() => expect(marcarVarios).toHaveBeenCalledWith([1, 2], { tag: "viagem Exemplo" }));
  await waitFor(() => expect(screen.queryByText("2 selecionados")).toBeNull());
});

test("a tag do movimento aparece na linha", () => {
  render(<Lista movimentos={[movimento({ tags: ["viagem Exemplo"] })]} contas={CONTAS} />);

  expect(screen.getByText("viagem Exemplo")).toBeTruthy();
});

test("categoria para vários usa a mesma lista com ícones e manda a escolhida", async () => {
  marcarVarios.mockResolvedValue({ erro: null });
  render(
    <Lista
      movimentos={[movimento({ id: 1, descricao: "Pousada" }), movimento({ id: 2, descricao: "Restaurante" })]}
      contas={CONTAS}
      categorias={[
        { id: "viagem", nome: "Viagem", icone: "Plane", cor: 220 },
        { id: "lazer", nome: "Lazer", icone: "PartyPopper", cor: 305 },
      ]}
    />,
  );

  fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
  fireEvent.click(screen.getByRole("button", { name: "Categoria" }));
  fireEvent.click(screen.getByRole("radio", { name: "Viagem" }));
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

  await waitFor(() => expect(marcarVarios).toHaveBeenCalledWith([1, 2], { categoria: "viagem" }));
});
