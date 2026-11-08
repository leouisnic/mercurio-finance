import { expect, test } from "vitest";
import { maiorDia, mediaPorDia, projecao } from "./analise-do-grafico";

test("média e projeção contam zeros e o ritmo usa só os sete últimos dias", () => {
  const passados = [700, 0, 0, 0, 0, 0, 0, 70].map((valor, indice) => ({
    data: `2026-08-${String(indice + 1).padStart(2, "0")}`, valor,
  }));
  expect(mediaPorDia(passados)).toBe(96.25);
  expect(projecao(passados, 3)).toEqual({ ritmo: 10, total: 800 });
  expect(maiorDia(passados)).toBe("2026-08-01");
});

test("vazio, só zeros, empate e período encerrado", () => {
  expect(mediaPorDia([])).toBeNull();
  expect(maiorDia([])).toBeNull();
  expect(maiorDia([{ data: "2026-08-01", valor: 0 }])).toBeNull();
  const empate = [{ data: "2026-08-01", valor: 20 }, { data: "2026-08-02", valor: 20 }];
  expect(maiorDia(empate)).toBe("2026-08-01");
  expect(projecao([], 3)).toBeNull();
  expect(projecao(empate, 0)).toBeNull();
});
