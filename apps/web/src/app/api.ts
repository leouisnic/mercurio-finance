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

export const FINANCE_API_URL = process.env.FINANCE_API_URL ?? "http://localhost:8000";

export async function buscarJson<T>(
  caminho: string,
  parametros: Record<string, string | number | undefined> = {},
): Promise<T | null> {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined) {
      query.set(chave, String(valor));
    }
  }
  const busca = query.size > 0 ? `?${query}` : "";

  try {
    const resposta = await fetch(`${FINANCE_API_URL}${caminho}${busca}`, {
      cache: "no-store",
    });
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
