import { revalidatePath } from "next/cache";
import { FINANCE_API_URL } from "./api";

/**
 * Enfileira uma sincronização com a Pluggy (`POST /sync/pluggy`, só
 * leitura no lado da Pluggy) e recarrega a página.
 *
 * O job roda em segundo plano, então o painel não espera o resultado: o
 * recarregamento mostra o que já estava gravado, e o selo de "atualizado
 * há X" revela quando o dado novo chega.
 */
export async function sincronizar(): Promise<void> {
  "use server";
  try {
    await fetch(`${FINANCE_API_URL}/sync/pluggy`, { method: "POST", cache: "no-store" });
  } catch {
    // Falha de sincronização não derruba a tela: o selo continua mostrando
    // a idade do dado que já está lá.
  }
  revalidatePath("/");
}

/**
 * Decide uma recorrência e, na mesma chamada, a classifica. O `PATCH`
 * aceita apelido, categoria e status juntos, então aprovar já
 * classificando é uma requisição só.
 *
 * Rejeitar é definitivo em relação à detecção: a sincronização seguinte
 * reencontra o mesmo padrão e não devolve a recorrência para a fila.
 */
export async function decidirRecorrencia(dados: FormData): Promise<void> {
  "use server";
  const id = String(dados.get("id"));
  const apelido = String(dados.get("apelido") ?? "").trim();
  const categoria = String(dados.get("categoria") ?? "");
  const status = String(dados.get("status") ?? "");

  const alteracoes: Record<string, string | null> = {};
  if (apelido) {
    alteracoes.apelido = apelido;
  }
  if (categoria) {
    alteracoes.categoria = categoria;
  }
  if (status) {
    alteracoes.status = status;
  }

  try {
    await fetch(`${FINANCE_API_URL}/recorrencias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alteracoes),
      cache: "no-store",
    });
  } catch {
    // Falha de rede não derruba a tela: o recarregamento mostra que a
    // recorrência continua onde estava.
  }
  revalidatePath("/recorrencias");
}

/** Renomeia uma conta. Apelido vazio limpa e volta ao nome da Pluggy. */
export async function renomearConta(dados: FormData): Promise<void> {
  "use server";
  const id = String(dados.get("conta_id"));
  const apelido = String(dados.get("apelido") ?? "").trim();

  try {
    await fetch(`${FINANCE_API_URL}/contas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apelido: apelido || null }),
      cache: "no-store",
    });
  } catch {
    // Mesmo motivo do acima.
  }
  revalidatePath("/");
  revalidatePath("/movimentos");
}
