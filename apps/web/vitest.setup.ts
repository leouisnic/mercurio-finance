import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Segredo fictício da sessão: os testes rodam como quem já entrou, e quem
// testa a falta de sessão apaga o cookie em `globalThis.cookieDaSessaoDeTeste`.
process.env.PAINEL_SEGREDO_DA_SESSAO = "segredo-ficticio-dos-testes";

declare global {
  var cookieDaSessaoDeTeste: string | undefined;
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      globalThis.cookieDaSessaoDeTeste
        ? { name: nome, value: globalThis.cookieDaSessaoDeTeste }
        : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => new Headers(),
}));

beforeEach(async () => {
  const { assinarSessao } = await import("./src/app/sessao");
  globalThis.cookieDaSessaoDeTeste = assinarSessao(
    Date.now(),
    "segredo-ficticio-dos-testes",
  );
});

afterEach(() => {
  cleanup();
});
