import { afterEach, describe, expect, test, vi } from "vitest";
// O script de definir a senha é quem gera o hash de verdade.
import { gerarHash } from "../../scripts/definir-senha.mjs";
import { chamarApi } from "./api";
import {
  DURACAO_DA_SESSAO_S,
  ESPERA_MS,
  TENTATIVAS_ANTES_DA_ESPERA,
  assinarSessao,
  esperaRestante,
  registrarErro,
  senhaConfere,
  sessaoValida,
  zerarTentativas,
} from "./sessao";

const SEGREDO = "segredo-ficticio";
const AGORA = Date.UTC(2026, 10, 12, 12);

describe("cookie da sessão", () => {
  test("vale com o mesmo segredo dentro dos 30 dias", () => {
    const valor = assinarSessao(AGORA, SEGREDO);

    expect(sessaoValida(valor, AGORA, SEGREDO)).toBe(true);
    expect(sessaoValida(valor, AGORA + (DURACAO_DA_SESSAO_S - 1) * 1000, SEGREDO)).toBe(true);
  });

  test("expira no fim dos 30 dias", () => {
    const valor = assinarSessao(AGORA, SEGREDO);

    expect(sessaoValida(valor, AGORA + DURACAO_DA_SESSAO_S * 1000, SEGREDO)).toBe(false);
  });

  test("adulterado não vale: esticar a validade quebra a assinatura", () => {
    const [, assinatura] = assinarSessao(AGORA, SEGREDO).split(".");
    const esticado = `${Math.floor(AGORA / 1000) + 10 * DURACAO_DA_SESSAO_S}.${assinatura}`;

    expect(sessaoValida(esticado, AGORA, SEGREDO)).toBe(false);
    expect(sessaoValida("lixo", AGORA, SEGREDO)).toBe(false);
    expect(sessaoValida("1.2.3", AGORA, SEGREDO)).toBe(false);
  });

  test("trocar o segredo derruba todos os aparelhos", () => {
    const valor = assinarSessao(AGORA, SEGREDO);

    expect(sessaoValida(valor, AGORA, "outro-segredo")).toBe(false);
  });

  test("sem segredo configurado nenhuma sessão vale", () => {
    expect(sessaoValida(assinarSessao(AGORA, SEGREDO), AGORA, undefined)).toBe(false);
    expect(sessaoValida(undefined, AGORA, SEGREDO)).toBe(false);
  });
});

describe("senha", () => {
  const hash = gerarHash("senha-ficticia-1");

  test("a certa confere com o hash do script", () => {
    expect(senhaConfere("senha-ficticia-1", hash)).toBe(true);
  });

  test("a errada não confere", () => {
    expect(senhaConfere("senha-ficticia-2", hash)).toBe(false);
    expect(senhaConfere("", hash)).toBe(false);
  });

  test("sem hash, ou hash estranho, nada confere", () => {
    expect(senhaConfere("senha-ficticia-1", undefined)).toBe(false);
    expect(senhaConfere("senha-ficticia-1", "texto-puro")).toBe(false);
  });

  test("o hash não guarda a senha", () => {
    expect(hash).not.toContain("senha-ficticia-1");
  });
});

describe("tentativas", () => {
  afterEach(() => zerarTentativas());

  test("a quinta senha errada começa a espera de 15 minutos", () => {
    for (let erro = 1; erro < TENTATIVAS_ANTES_DA_ESPERA; erro += 1) {
      expect(registrarErro(AGORA)).toBe(0);
    }

    expect(registrarErro(AGORA)).toBe(ESPERA_MS);
    expect(esperaRestante(AGORA + 60_000)).toBe(ESPERA_MS - 60_000);
  });

  test("passada a espera, volta a contar do zero", () => {
    for (let erro = 0; erro < TENTATIVAS_ANTES_DA_ESPERA; erro += 1) registrarErro(AGORA);

    expect(esperaRestante(AGORA + ESPERA_MS)).toBe(0);
    expect(registrarErro(AGORA + ESPERA_MS)).toBe(0);
  });
});

describe("chamarApi", () => {
  test("sem sessão não chama a API", async () => {
    globalThis.cookieDaSessaoDeTeste = undefined;
    const buscar = vi.spyOn(globalThis, "fetch");

    const resposta = await chamarApi("/resumo");

    expect(resposta.status).toBe(401);
    expect(buscar).not.toHaveBeenCalled();
    buscar.mockRestore();
  });

  test("com sessão chama a API com o token", async () => {
    const buscar = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await chamarApi("/resumo");

    expect(buscar).toHaveBeenCalledOnce();
    buscar.mockRestore();
  });
});
