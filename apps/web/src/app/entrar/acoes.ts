"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  DURACAO_DA_SESSAO_S,
  NOME_DO_COOKIE,
  assinarSessao,
  esperaRestante,
  registrarErro,
  senhaConfere,
  zerarTentativas,
} from "../sessao";
import type { EstadoDaEntrada } from "./estado";

function emMinutos(ms: number): number {
  return Math.max(1, Math.ceil(ms / 60_000));
}

export async function entrar(
  _anterior: EstadoDaEntrada,
  dados: FormData,
): Promise<EstadoDaEntrada> {
  const hash = process.env.PAINEL_SENHA_HASH;
  const segredo = process.env.PAINEL_SEGREDO_DA_SESSAO;
  if (!hash || !segredo) {
    return {
      erro: "A senha do painel ainda não foi definida. Veja docs/security.md.",
      esperaMinutos: 0,
    };
  }

  const agora = Date.now();
  const falta = esperaRestante(agora);
  if (falta > 0) return { erro: null, esperaMinutos: emMinutos(falta) };

  if (!senhaConfere(String(dados.get("senha") ?? ""), hash)) {
    const espera = registrarErro(agora);
    return espera > 0
      ? { erro: null, esperaMinutos: emMinutos(espera) }
      : { erro: "Senha incorreta.", esperaMinutos: 0 };
  }

  zerarTentativas();
  // Pelo Tailscale o pedido chega por HTTPS e o cookie só anda cifrado; aqui
  // na máquina é HTTP, onde Secure impediria o navegador de guardá-lo.
  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(NOME_DO_COOKIE, assinarSessao(agora, segredo), {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: DURACAO_DA_SESSAO_S,
  });
  redirect("/");
}

export async function sair(): Promise<void> {
  (await cookies()).delete(NOME_DO_COOKIE);
  redirect("/entrar");
}
