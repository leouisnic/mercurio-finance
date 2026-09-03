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
    reserva_das: {
      referencia: "competencia_atual",
      valor_reservado: "620.00",
      valor_previsto: "650.00",
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
    reservaDas: {
      referencia: "competencia_atual",
      valorReservado: 620,
      valorPrevisto: 650,
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
