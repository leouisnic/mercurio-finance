import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SeletorDeTema } from "./tema";

let sistemaEscuro = false;

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.tema;
  // O jsdom não tem matchMedia; aqui ele responde como o sistema do teste.
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("dark") && sistemaEscuro,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  sistemaEscuro = false;
});

test("escolher o escuro troca a página e fica guardado", () => {
  render(<SeletorDeTema />);

  fireEvent.click(screen.getByRole("button", { name: "Tema escuro" }));

  expect(document.documentElement.dataset.tema).toBe("escuro");
  expect(localStorage.getItem("tema")).toBe("escuro");
  expect(screen.getByRole("button", { name: "Tema escuro" }).getAttribute("aria-pressed")).toBe("true");
});

test("voltar a seguir o sistema esquece a escolha e usa o tema do sistema", () => {
  sistemaEscuro = true;
  localStorage.setItem("tema", "claro");
  render(<SeletorDeTema />);
  expect(screen.getByRole("button", { name: "Tema claro" }).getAttribute("aria-pressed")).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "Seguir o sistema" }));

  expect(localStorage.getItem("tema")).toBeNull();
  expect(document.documentElement.dataset.tema).toBe("escuro");
  expect(screen.getByRole("button", { name: "Seguir o sistema" }).getAttribute("aria-pressed")).toBe("true");
});
