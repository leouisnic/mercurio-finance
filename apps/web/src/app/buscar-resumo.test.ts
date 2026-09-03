import { afterEach, expect, test, vi } from "vitest";
import { buscarResumo } from "./buscar-resumo";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("converte a resposta do finance-api (snake_case, valores em string) para o formato do painel", async () => {
  const corpoDaApi = {
    atualizado_em: "2026-08-15",
    contas: [
      { id: "c1", nome: "Banco X", tipo: "BANK", saldo: "254.50", limite: null, disponivel: null },
      {
        id: "c2",
        nome: "Cartão gold",
        tipo: "CREDIT",
        saldo: "340.04",
        limite: "350.00",
        disponivel: "9.96",
      },
    ],
  };

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(corpoDaApi),
    }),
  );

  const resumo = await buscarResumo();

  expect(resumo).toEqual({
    atualizadoEm: "2026-08-15",
    contas: [
      { id: "c1", nome: "Banco X", tipo: "BANK", saldo: 254.5, limite: null, disponivel: null },
      { id: "c2", nome: "Cartão gold", tipo: "CREDIT", saldo: 340.04, limite: 350, disponivel: 9.96 },
    ],
  });
});

test("devolve null quando o finance-api responde com erro", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

  expect(await buscarResumo()).toBeNull();
});

test("devolve null quando o finance-api está fora do ar", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("fetch failed")),
  );

  expect(await buscarResumo()).toBeNull();
});
