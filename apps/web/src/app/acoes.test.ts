import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { decidirRecorrencia, renomearConta, sincronizar } from "./acoes";

// `vi.mock` sobe para o topo do arquivo, antes de qualquer `const`.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function formulario(campos: Record<string, string>): FormData {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) {
    dados.set(chave, valor);
  }
  return dados;
}

function apiRespondendo(status: number) {
  const fetch = vi.fn(async () => new Response("{}", { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  revalidatePath.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("decisão com a API devolvendo 503 informa o erro e não recarrega como sucesso", async () => {
  apiRespondendo(503);

  const resultado = await decidirRecorrencia(formulario({ id: "7", status: "aprovada" }));

  expect(resultado.erro).toMatch(/erro 503/);
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("decisão aceita pela API recarrega a fila", async () => {
  apiRespondendo(200);

  const resultado = await decidirRecorrencia(formulario({ id: "7", status: "aprovada" }));

  expect(resultado.erro).toBeNull();
  expect(revalidatePath).toHaveBeenCalledWith("/recorrencias");
});

test("API fora do ar vira erro, não exceção", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("fetch failed");
    }),
  );

  expect((await renomearConta(formulario({ conta_id: "c1", apelido: "X" }))).erro).toMatch(
    /não respondeu/,
  );
  expect((await sincronizar()).erro).toMatch(/não respondeu/);
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("voltar ao nome do banco manda apelido nulo", async () => {
  const fetch = apiRespondendo(200);

  await renomearConta(formulario({ conta_id: "c1", apelido: "Digitado", limpar: "1" }));

  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toMatch(/\/contas\/c1$/);
  expect(JSON.parse(String(init.body))).toEqual({ apelido: null });
});
