import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
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

  expect(screen.getByText("Nubank · Conta")).toBeDefined();
});

test("recorte sem movimento diz isso em vez de mostrar tabela vazia", () => {
  render(<Lista movimentos={[]} contas={CONTAS} />);

  expect(screen.getByText("Nenhum movimento neste recorte.")).toBeDefined();
});
