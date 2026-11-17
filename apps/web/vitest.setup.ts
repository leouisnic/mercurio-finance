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

// O jsdom não tem `matchMedia`. Por padrão a tela é de computador; o teste
// que precisa do celular troca `globalThis.telaDeCelularDeTeste`.
declare global {
  var telaDeCelularDeTeste: boolean;
}

beforeEach(() => {
  globalThis.telaDeCelularDeTeste = false;
  if (
    typeof window !== "undefined" &&
    !("matchMedia" in window && vi.isMockFunction(window.matchMedia))
  ) {
    window.matchMedia = vi.fn((consulta: string) => ({
      matches: consulta.includes("max-width")
        ? globalThis.telaDeCelularDeTeste
        : false,
      media: consulta,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }
});

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
