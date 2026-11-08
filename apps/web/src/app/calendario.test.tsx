import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { CalendarioDeIntervalo, CampoDeData } from "./calendario";

test("atalho atravessa o ano em datas civis e limpar exige nova seleção", () => {
  const aplicar = vi.fn();
  render(<CalendarioDeIntervalo hoje="2026-01-03" aplicar={aplicar} />);
  const confirmar = screen.getByRole("button", { name: "Aplicar" }) as HTMLButtonElement;
  expect(confirmar.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Últimos 7 dias" }));
  fireEvent.click(confirmar);
  expect(aplicar).toHaveBeenCalledWith("2025-12-28", "2026-01-03");
  fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
  expect(confirmar.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Mês passado" }));
  fireEvent.click(confirmar);
  expect(aplicar).toHaveBeenLastCalledWith("2025-12-01", "2025-12-31");
});

test("data única seleciona em português sem deslocar o dia e fecha", async () => {
  const mudar = vi.fn();
  render(<CampoDeData valor="" mudar={mudar} rotulo="Data" hoje="2026-10-01" minimo="2026-10-10" />);
  fireEvent.click(screen.getByRole("button", { name: "Data: escolher" }));
  expect((screen.getByRole("button", { name: /, 9 de outubro de 2026$/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /20 de outubro de 2026/ }));
  expect(mudar).toHaveBeenCalledWith("2026-10-20");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Data" })).toBeNull());
});
