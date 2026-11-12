import { type NextRequest, NextResponse } from "next/server";
import { NOME_DO_COOKIE, sessaoValida } from "./app/sessao";

const ENTRAR = "/entrar";

/**
 * Endereço para onde redirecionar como o navegador o vê. Atrás do
 * `tailscale serve` o pedido chega em 127.0.0.1, e redirecionar para lá
 * mandaria o celular para um endereço que ele não alcança.
 */
function enderecoPublico(request: NextRequest, caminho: string): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocolo = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return new URL(caminho, host ? `${protocolo}://${host}` : request.url);
}

/**
 * Sem sessão, toda página vai para a entrada. É a primeira barreira; a que
 * vale para os dados é `chamarApi`, que confere a sessão de novo antes de
 * qualquer chamada à API, inclusive nas ações do servidor.
 */
export function proxy(request: NextRequest) {
  const valida = sessaoValida(
    request.cookies.get(NOME_DO_COOKIE)?.value,
    Date.now(),
    process.env.PAINEL_SEGREDO_DA_SESSAO,
  );
  const naEntrada = request.nextUrl.pathname === ENTRAR;
  if (!valida && !naEntrada) {
    return NextResponse.redirect(enderecoPublico(request, ENTRAR));
  }
  if (valida && naEntrada) {
    return NextResponse.redirect(enderecoPublico(request, "/"));
  }
  return NextResponse.next();
}

export const config = {
  // Arquivos estáticos e imagens públicas não têm dado e a tela de entrada
  // precisa deles.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|marca/|bancos/|bandeiras/).*)",
  ],
};
