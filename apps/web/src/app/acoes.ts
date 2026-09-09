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
