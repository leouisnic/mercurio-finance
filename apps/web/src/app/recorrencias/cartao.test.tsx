import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CartaoPendente, LinhaDecidida } from "./cartao";
import type { Recorrencia } from "../buscar-recorrencias";
import type { Conta } from "../buscar-resumo";

// A server action nao roda em jsdom: aqui o que importa e' a fiacao do
// formulario, ou seja, que os campos e os botoes mandem o par certo.
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
  fechamento: null,
  vencimento: null,
};

function recorrencia(campos: Partial<Recorrencia> = {}): Recorrencia {
  return {
    id: 7,
    contaId: "conta-b",
    descricao: "NETFLIX.COM",
    apelido: null,
    categoria: null,
    valorMedio: 65,
    ocorrencias: 3,
    primeiraData: "2026-06-10",
    ultimaData: "2026-08-10",
    status: "pendente",
    ...campos,
  };
}

test("candidata mostra valor, historico e a conta pelo apelido", () => {
  render(<CartaoPendente recorrencia={recorrencia()} conta={CONTA} />);

  expect(screen.getByText("NETFLIX.COM")).toBeDefined();
  expect(screen.getByText("R$ 65,00")).toBeDefined();
  expect(screen.getByText("3 cobranças, de 10/06 a 10/08")).toBeDefined();
  expect(screen.getByText("Cartão Nubank")).toBeDefined();
});

test("aprovar e rejeitar enviam o mesmo formulario com status diferente", () => {
  render(<CartaoPendente recorrencia={recorrencia()} conta={CONTA} />);

  const aprovar = screen.getByRole("button", { name: "Aprovar" });
  const rejeitar = screen.getByRole("button", { name: "Rejeitar" });

  expect(aprovar.getAttribute("name")).toBe("status");
  expect(aprovar.getAttribute("value")).toBe("aprovada");
  expect(rejeitar.getAttribute("name")).toBe("status");
  expect(rejeitar.getAttribute("value")).toBe("rejeitada");
  // O id vai junto, senao a acao nao sabe qual recorrencia decidir.
  expect(aprovar.closest("form")?.querySelector('input[name="id"]')?.getAttribute("value")).toBe(
    "7",
  );
});

test("as sete categorias fixas aparecem, mais a opcao de nenhuma", () => {
  render(<CartaoPendente recorrencia={recorrencia()} conta={CONTA} />);

  const categoria = screen.getByLabelText("Categoria") as HTMLSelectElement;
  expect([...categoria.options].map((o) => o.value)).toEqual([
    "",
    "saude",
    "familia",
    "moradia",
    "assinatura",
    "transporte",
    "alimentacao",
    "outros",
  ]);
});

test("candidata ja classificada volta com apelido e categoria preenchidos", () => {
  render(
    <CartaoPendente
      recorrencia={recorrencia({ apelido: "Streaming", categoria: "assinatura" })}
      conta={CONTA}
    />,
  );

  expect((screen.getByLabelText("Apelido") as HTMLInputElement).value).toBe("Streaming");
  expect((screen.getByLabelText("Categoria") as HTMLSelectElement).value).toBe("assinatura");
  // O apelido vira o titulo, e a descricao do banco fica como contexto.
  expect(screen.getByText("Streaming")).toBeDefined();
  expect(screen.getByText(/NETFLIX.COM/)).toBeDefined();
});

test("rejeitar avisa que a deteccao nao devolve a candidata para a fila", () => {
  render(<CartaoPendente recorrencia={recorrencia()} conta={CONTA} />);

  expect(screen.getByRole("button", { name: "Rejeitar" }).getAttribute("title")).toMatch(
    /não devolve/,
  );
});

test("ja decidida permite voltar atras para o estado oposto", () => {
  const { rerender } = render(
    <LinhaDecidida
      recorrencia={recorrencia({ status: "aprovada", categoria: "assinatura" })}
      conta={CONTA}
    />,
  );

  const voltar = screen.getByRole("button", { name: "Rejeitar" });
  expect(voltar.getAttribute("value")).toBe("rejeitada");
  expect(screen.getByText("Assinatura")).toBeDefined();

  rerender(
    <LinhaDecidida recorrencia={recorrencia({ status: "rejeitada" })} conta={CONTA} />,
  );
  expect(screen.getByRole("button", { name: "Aprovar" }).getAttribute("value")).toBe("aprovada");
});

test("conta desconhecida cai no id, em vez de quebrar o cartao", () => {
  render(<CartaoPendente recorrencia={recorrencia()} />);

  expect(screen.getByText("conta-b")).toBeDefined();
  expect(screen.getByRole("button", { name: "Aprovar" })).toBeDefined();
});
