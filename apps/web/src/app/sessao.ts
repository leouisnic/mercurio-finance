// A sessão do painel: cookie assinado, conferência da senha e contagem de
// tentativas. Só o servidor lê os segredos; o `server-only` faz a compilação
// falhar se um componente do navegador importar este arquivo.
import "server-only";

import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const NOME_DO_COOKIE = "mercurio_sessao";
// Escolha do dono: cada aparelho pede a senha de novo a cada 30 dias.
export const DURACAO_DA_SESSAO_S = 30 * 24 * 60 * 60;
// Depois de 5 senhas erradas, espera de 15 minutos.
export const TENTATIVAS_ANTES_DA_ESPERA = 5;
export const ESPERA_MS = 15 * 60 * 1000;

function assinatura(conteudo: string, segredo: string): string {
  return createHmac("sha256", segredo).update(conteudo).digest("base64url");
}

/** O valor do cookie: até quando vale, em segundos, e a assinatura disso. */
export function assinarSessao(agoraMs: number, segredo: string): string {
  const expira = String(Math.floor(agoraMs / 1000) + DURACAO_DA_SESSAO_S);
  return `${expira}.${assinatura(expira, segredo)}`;
}

/** Sem segredo configurado, nenhuma sessão vale: o painel fica fechado. */
export function sessaoValida(
  valor: string | undefined,
  agoraMs: number,
  segredo: string | undefined,
): boolean {
  if (!valor || !segredo) return false;
  const [expira, recebida, sobra] = valor.split(".");
  if (!expira || !recebida || sobra !== undefined) return false;
  const esperada = Buffer.from(assinatura(expira, segredo));
  const veio = Buffer.from(recebida);
  if (esperada.length !== veio.length || !timingSafeEqual(esperada, veio)) {
    return false;
  }
  return Number(expira) * 1000 > agoraMs;
}

/** Confere a senha contra o hash de `scripts/definir-senha.mjs`. */
export function senhaConfere(senha: string, hash: string | undefined): boolean {
  if (!hash) return false;
  const partes = hash.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, sal, chave] = partes;
  const esperada = Buffer.from(chave, "base64url");
  const calculada = scryptSync(senha, Buffer.from(sal, "base64url"), esperada.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(esperada, calculada);
}

/** A sessão do pedido atual, lida do cookie. */
export async function temSessao(): Promise<boolean> {
  const valor = (await cookies()).get(NOME_DO_COOKIE)?.value;
  return sessaoValida(valor, Date.now(), process.env.PAINEL_SEGREDO_DA_SESSAO);
}

// Contagem em memória do processo: reiniciar o painel zera, aceitável com ele
// atrás do Tailscale, onde só os aparelhos do dono chegam.
let erros = 0;
let esperaAte = 0;

/** Milissegundos que ainda faltam de espera; zero se pode tentar. */
export function esperaRestante(agoraMs: number): number {
  if (esperaAte > agoraMs) return esperaAte - agoraMs;
  if (esperaAte !== 0) {
    esperaAte = 0;
    erros = 0;
  }
  return 0;
}

/** Conta uma senha errada e devolve a espera que ela causou, se causou. */
export function registrarErro(agoraMs: number): number {
  erros += 1;
  if (erros >= TENTATIVAS_ANTES_DA_ESPERA) {
    esperaAte = agoraMs + ESPERA_MS;
    return ESPERA_MS;
  }
  return 0;
}

export function zerarTentativas(): void {
  erros = 0;
  esperaAte = 0;
}
