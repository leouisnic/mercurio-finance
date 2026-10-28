import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { CabecalhoDaConta } from "./cabecalho-da-conta";
import type { Conta } from "./buscar-resumo";
import { CartaoDecidido } from "./recorrencias/cartao";

// A ação devolve o erro como a de verdade faz quando a API responde 503.
vi.mock("./acoes", () => ({
  renomearConta: vi.fn(async () => ({ erro: "Não foi possível salvar: a API respondeu com erro 503. O nome digitado foi mantido." })),
  decidirRecorrencia: vi.fn(async () => ({ erro: "Não foi possível registrar a decisão: a API respondeu com erro 503. O que você preencheu foi mantido." })),
}));

const CONTA: Conta = {
  id: "conta-a",
  nome: "Conta A (fictícia)",
  apelido: null,
  tipo: "BANK",
  saldo: 2898.4,
  limite: null,
  disponivel: null,
  bandeira: null,
  final: null,
  itemId: null,
  fechamento: null,
  vencimento: null,
};

test("renomear que falha mostra o erro e mantém o nome digitado", async () => {
  render(<CabecalhoDaConta conta={CONTA} subtitulo="Conta corrente" />);
  fireEvent.click(screen.getByRole("button", { name: "Renomear Conta A (fictícia)" }));
  fireEvent.change(screen.getByLabelText("Apelido da conta"), {
    target: { value: "Conta principal" },
  });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  });

  expect((await screen.findByRole("alert")).textContent).toMatch(/erro 503/);
  expect((screen.getByLabelText("Apelido da conta") as HTMLInputElement).value).toBe(
    "Conta principal",
  );
});

test("decisão que falha mostra o erro e mantém apelido e categoria", async () => {
  render(
    <CartaoDecidido
      recorrencia={{
        id: 7,
        contaId: "conta-a",
        descricao: "Compra no débito|NETFLIX.COM",
        apelido: null,
        categoria: null,
        valorMedio: 65,
        ocorrencias: 3,
        primeiraData: "2026-06-10",
        ultimaData: "2026-08-10",
        status: "aprovada",
        fimPrevisto: null,
      }}
      conta={CONTA}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Mudar" }));
  fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "Streaming" } });
  fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "assinatura" } });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Conta fixa" }));
  });

  expect((await screen.findByRole("alert")).textContent).toMatch(/erro 503/);
  expect((screen.getByLabelText("Apelido") as HTMLInputElement).value).toBe("Streaming");
  expect((screen.getByLabelText("Categoria") as HTMLSelectElement).value).toBe("assinatura");
});
