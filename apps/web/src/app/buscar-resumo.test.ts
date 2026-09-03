import { afterEach, expect, test, vi } from "vitest";
import { buscarResumo } from "./buscar-resumo";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("converte a resposta do finance-api (snake_case, valores em string) para o formato do painel", async () => {
  const corpoDaApi = {
    atualizado_em: "2026-08-15",
    titularidades: [
      { titularidade: "pf", nome: "Pessoa Física", saldo: "254.50" },
      { titularidade: "pj", nome: "Pessoa Jurídica", saldo: "2550.00" },
    ],
    obrigacao_das: {
      competencia: "2026-08",
      valor: "86.05",
      paga: false,
    },
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
    titularidades: [
      { id: "pf", nome: "Pessoa Física", saldo: 254.5 },
      { id: "pj", nome: "Pessoa Jurídica", saldo: 2550 },
    ],
    obrigacaoDas: {
      competencia: "2026-08",
      valor: 86.05,
      paga: false,
    },
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
