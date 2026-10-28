import { expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CartaoDecidido, CartaoPendente, partesDaDescricao } from "./cartao";
import type { Recorrencia } from "../buscar-recorrencias";
import type { Conta } from "../buscar-resumo";

// A server action não roda em jsdom: aqui o que importa é a fiação do
// formulário, ou seja, que cada botão mande o estado certo.
vi.mock("../acoes", () => ({ decidirRecorrencia: () => {} }));

const CONTA: Conta = {
  id: "conta-b",
  nome: "gold",
  apelido: "Cartão Nubank",
  tipo: "CREDIT",
  saldo: 143.12,
  limite: 350,
  disponivel: 206.88,
  bandeira: "MASTERCARD",
  final: "4073",
  itemId: null,
  fechamento: null,
  vencimento: null,
};

function recorrencia(campos: Partial<Recorrencia> = {}): Recorrencia {
  return {
    id: 7,
    contaId: "conta-b",
    descricao: "Transferência enviada|Pessoa Fictícia",
    apelido: null,
    categoria: null,
    valorMedio: 65,
    ocorrencias: 3,
    primeiraData: "2026-06-10",
    ultimaData: "2026-08-10",
    status: "pendente",
    fimPrevisto: null,
    ...campos,
  };
}

test("o nome vem depois do |, e o tipo da cobrança vira contexto", () => {
  expect(partesDaDescricao("Transferência enviada|Pessoa Fictícia")).toEqual({
    nome: "Pessoa Fictícia",
    tipo: "Transferência enviada",
  });
  expect(partesDaDescricao("NETFLIX.COM")).toEqual({ nome: "NETFLIX.COM", tipo: null });
});

test("candidata mostra nome, tipo, banco, valor e histórico", () => {
  render(<CartaoPendente recorrencia={recorrencia()} conta={CONTA} />);

  expect(screen.getByText("Pessoa Fictícia")).toBeDefined();
  expect(screen.getByText("Transferência enviada no Cartão Nubank")).toBeDefined();
  expect(screen.getByText("R$ 65,00")).toBeDefined();
  expect(screen.getByText("3 cobranças, de 10/06 a 10/08")).toBeDefined();
});

test("as decisões mandam o estado certo", () => {
  render(<CartaoPendente recorrencia={recorrencia()} conta={CONTA} />);

  const valor = (nome: string) => screen.getByRole("button", { name: nome }).getAttribute("value");
  expect(valor("Conta fixa")).toBe("aprovada");
  expect(valor("Encerrada")).toBe("encerrada");
  expect(valor("Não é recorrência")).toBe("rejeitada");
  // O id vai junto, senão a ação não sabe qual recorrência decidir.
  expect(
    screen.getByRole("button", { name: "Conta fixa" }).closest("form")?.querySelector('input[name="id"]')?.getAttribute("value"),
  ).toBe("7");
});

test("parcelamento pede quantas parcelas faltam antes de confirmar", () => {
  render(<CartaoPendente recorrencia={recorrencia()} conta={CONTA} />);
  expect(screen.queryByLabelText("Parcelas que faltam")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Parcelamento" }));

  expect(screen.getByLabelText("Parcelas que faltam").getAttribute("name")).toBe("parcelas");
  expect(screen.getByRole("button", { name: "Confirmar" }).getAttribute("value")).toBe("parcelamento");
});

test("parcelamento decidido mostra quantas foram pagas e quando termina", () => {
  render(
    <CartaoDecidido
      recorrencia={recorrencia({ status: "parcelamento", ocorrencias: 6, fimPrevisto: "2027-02-10" })}
      conta={CONTA}
    />,
  );

  // Última cobrança em 08/2026 e fim em 02/2027: faltam 6, total 12.
  expect(screen.getByText("6 de 12 pagas")).toBeDefined();
  expect(screen.getByText("termina em 02/2027")).toBeDefined();
  expect(screen.getByText("Parcelamento")).toBeDefined();
});

test("decidida mostra o estado e abre as decisões em Mudar", () => {
  render(<CartaoDecidido recorrencia={recorrencia({ status: "encerrada" })} conta={CONTA} />);

  expect(screen.getByText("Encerrada")).toBeDefined();
  expect(screen.getByText("última em 10/08")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Conta fixa" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Mudar" }));

  expect(screen.getByRole("button", { name: "Conta fixa" })).toBeDefined();
  expect(screen.getByLabelText("Categoria")).toBeDefined();
});

test("conta desconhecida cai no id, em vez de quebrar o cartão", () => {
  render(<CartaoPendente recorrencia={recorrencia()} />);

  expect(screen.getByText("Transferência enviada em conta-b")).toBeDefined();
});
