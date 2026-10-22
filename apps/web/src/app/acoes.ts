"use server";

import { revalidatePath } from "next/cache";
import { FINANCE_API_URL } from "./api";

/** O que a tela precisa saber de uma ação: `erro` nulo é sucesso. */
export type ResultadoDaAcao = { erro: string | null };

/**
 * Chama a API e traduz a falha em motivo legível. Resposta fora de 2xx é
 * falha também: um 503 que termina como sucesso faria a tela recarregar
 * como se a decisão tivesse sido gravada.
 */
async function enviar(caminho: string, init: RequestInit): Promise<string | null> {
  try {
    const resposta = await fetch(`${FINANCE_API_URL}${caminho}`, { ...init, cache: "no-store" });
    return resposta.ok ? null : `a API respondeu com erro ${resposta.status}`;
  } catch {
    return "a API não respondeu";
  }
}

/**
 * Enfileira uma sincronização com a Pluggy (`POST /sync/pluggy`, só
 * leitura no lado da Pluggy) e recarrega a página.
 *
 * O job roda em segundo plano, então o painel não espera o resultado: o
 * recarregamento mostra o que já estava gravado, e o selo de "atualizado
 * há X" revela quando o dado novo chega.
 */
export async function sincronizar(): Promise<ResultadoDaAcao> {
  const motivo = await enviar("/sync/pluggy", { method: "POST" });
  if (motivo) {
    return { erro: `Não foi possível pedir a sincronização: ${motivo}.` };
  }
  revalidatePath("/");
  return { erro: null };
}

/**
 * Decide uma recorrência e, na mesma chamada, a classifica. O `PATCH`
 * aceita apelido, categoria e status juntos, então aprovar já
 * classificando é uma requisição só.
 *
 * Rejeitar é definitivo em relação à detecção: a sincronização seguinte
 * reencontra o mesmo padrão e não devolve a recorrência para a fila.
 */
export async function decidirRecorrencia(dados: FormData): Promise<ResultadoDaAcao> {
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

  const motivo = await enviar(`/recorrencias/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alteracoes),
  });
  if (motivo) {
    return { erro: `Não foi possível registrar a decisão: ${motivo}. O que você preencheu foi mantido.` };
  }
  revalidatePath("/recorrencias");
  return { erro: null };
}

/**
 * Renomeia uma conta. `limpar` apaga o apelido e volta ao nome da Pluggy;
 * apelido em branco faz o mesmo, porque a API recusa texto vazio.
 */
export async function renomearConta(dados: FormData): Promise<ResultadoDaAcao> {
  const id = String(dados.get("conta_id"));
  const apelido = dados.get("limpar") ? "" : String(dados.get("apelido") ?? "").trim();

  const motivo = await enviar(`/contas/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apelido: apelido || null }),
  });
  if (motivo) {
    return { erro: `Não foi possível salvar: ${motivo}. O nome digitado foi mantido.` };
  }
  revalidatePath("/");
  revalidatePath("/movimentos");
  return { erro: null };
}
