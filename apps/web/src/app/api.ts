/**
 * Acesso ao finance-api. Um lugar só para a URL base e para a regra de
 * falha: qualquer erro (rede, API fora do ar, resposta inválida) devolve
 * `null` em vez de lançar, porque em desenvolvimento o finance-api pode
 * não estar rodando e a página mostra um aviso em vez de quebrar.
 *
 * Valor monetário chega como string no JSON (o Pydantic serializa
 * `Decimal` assim) e é convertido para `number` aqui, formato que o resto
 * do painel espera.
 */

// O token sai daqui para o finance-api e nunca para o navegador: só o
// servidor do Next lê esta variável, e o `server-only` faz a compilação
// falhar se um componente do navegador importar este arquivo.
import "server-only";
import { temSessao } from "./sessao";

export const FINANCE_API_URL =
  process.env.FINANCE_API_URL ?? "http://localhost:8000";

/**
 * Toda chamada ao finance-api passa por aqui, com o token, e só com sessão:
 * é a barreira que vale também para as ações do servidor, que o proxy
 * sozinho não garante.
 */
export async function chamarApi(
  caminho: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!(await temSessao())) {
    return new Response(null, { status: 401, statusText: "Sem sessão" });
  }
  const cabecalhos = new Headers(init.headers);
  cabecalhos.set(
    "Authorization",
    `Bearer ${process.env.FINANCE_API_TOKEN ?? ""}`,
  );
  const resposta = await fetch(`${FINANCE_API_URL}${caminho}`, {
    ...init,
    headers: cabecalhos,
    cache: "no-store",
  });
  if (resposta.status === 401) {
    // Na tela vira "Indisponível", como qualquer falha; o log diz a causa.
    console.error(
      "O finance-api recusou o token: confira FINANCE_API_TOKEN no .env e reinicie pelo atalho.",
    );
  }
  return resposta;
}

export async function buscarJson<T>(
  caminho: string,
  parametros: Record<
    string,
    string | number | boolean | undefined | (string | number)[]
  > = {},
): Promise<T | null> {
  // Lista vira o parâmetro repetido (`?conta_id=a&conta_id=b`), que é como a API lê.
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      if (item !== undefined) {
        query.append(chave, String(item));
      }
    }
  }
  const busca = query.size > 0 ? `?${query}` : "";

  try {
    const resposta = await chamarApi(`${caminho}${busca}`);
    return resposta.ok ? ((await resposta.json()) as T) : null;
  } catch {
    return null;
  }
}

export function paraNumero(valor: string): number {
  return Number(valor);
}

export function paraNumeroOuNull(valor: string | null): number | null {
  return valor === null ? null : Number(valor);
}
