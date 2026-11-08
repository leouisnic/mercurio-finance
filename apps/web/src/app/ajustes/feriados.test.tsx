import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { Feriado } from "../buscar-feriados";
import { efeitoDoFeriado, Feriados } from "./feriados";

const acoes = vi.hoisted(() => ({
  salvarFeriado: vi.fn(),
  apagarFeriado: vi.fn(),
}));
vi.mock("../acoes", () => acoes);

const NOMES = { ciclo1: "Empresa A", ciclo2: "Empresa B" };
const FERIADO: Feriado = {
  id: 1,
  nome: "Aniversário da Cidade A",
  data: "2026-10-20",
  repeteTodoAno: true,
  mudaCiclo1: true,
  mudaCiclo2: false,
};

beforeEach(() => {
  acoes.salvarFeriado.mockReset();
  acoes.apagarFeriado.mockReset();
});

test("o efeito diz de quem o feriado muda o pagamento", () => {
  expect(efeitoDoFeriado({ mudaCiclo1: true, mudaCiclo2: false }, NOMES)).toBe(
    "Muda o pagamento de Empresa A",
  );
  expect(efeitoDoFeriado({ mudaCiclo1: false, mudaCiclo2: true }, NOMES)).toBe(
    "Muda o pagamento de Empresa B",
  );
  expect(efeitoDoFeriado({ mudaCiclo1: true, mudaCiclo2: true }, NOMES)).toBe(
    "Muda os dois pagamentos",
  );
  expect(efeitoDoFeriado({ mudaCiclo1: false, mudaCiclo2: false }, NOMES)).toBe(
    "Só marca no gráfico",
  );
});

test("salvar manda os campos marcados e avisa quando um ciclo passado mudou", async () => {
  acoes.salvarFeriado.mockResolvedValue({ erro: null, mudaCicloPassado: true });
  render(<Feriados feriados={[]} nomes={NOMES} nacionais={[]} hoje="2026-10-01" />);
  // O formulário só aparece depois de "Novo feriado".
  expect(screen.queryByLabelText("Nome")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Novo feriado" }));

  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "Aniversário da Cidade A" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Data: escolher" }));
  fireEvent.click(screen.getByRole("button", { name: /20 de outubro de 2026/ }));
  fireEvent.click(screen.getByLabelText("Empresa B, Paga o ciclo 2, dia 15"));
  fireEvent.click(screen.getByRole("button", { name: "Salvar feriado" }));

  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "ciclo que já passou",
    ),
  );
  expect(acoes.salvarFeriado.mock.calls[0][0]).toEqual({
    nome: "Aniversário da Cidade A",
    data: "2026-10-20",
    repete_todo_ano: true,
    muda_ciclo_1: false,
    muda_ciclo_2: true,
  });
});

test("falha ao apagar aparece na linha do feriado", async () => {
  acoes.apagarFeriado.mockResolvedValue({
    erro: "Não foi possível apagar o feriado: a API não respondeu.",
  });
  render(
    <Feriados
      feriados={[FERIADO]}
      nomes={NOMES}
      nacionais={[{ data: "2026-11-02", nome: "Finados" }]}
      hoje="2026-10-01"
    />,
  );

  screen.getByText("Muda o pagamento de Empresa A");
  fireEvent.click(
    screen.getByRole("button", { name: "Apagar Aniversário da Cidade A" }),
  );

  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "a API não respondeu",
    ),
  );
  expect(acoes.apagarFeriado).toHaveBeenCalledWith(1);
});

test("editar abre o formulário com o feriado e salva no mesmo id", async () => {
  acoes.salvarFeriado.mockResolvedValue({
    erro: null,
    mudaCicloPassado: false,
  });
  render(<Feriados feriados={[FERIADO]} nomes={NOMES} nacionais={[]} hoje="2026-10-01" />);

  fireEvent.click(
    screen.getByRole("button", { name: "Editar Aniversário da Cidade A" }),
  );
  expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe(
    "Aniversário da Cidade A",
  );
  fireEvent.click(screen.getByRole("button", { name: "Salvar feriado" }));

  await waitFor(() => expect(acoes.salvarFeriado).toHaveBeenCalled());
  expect(acoes.salvarFeriado.mock.calls[0]).toEqual([
    {
      nome: "Aniversário da Cidade A",
      data: "2026-10-20",
      repete_todo_ano: true,
      muda_ciclo_1: true,
      muda_ciclo_2: false,
    },
    1,
  ]);
});
