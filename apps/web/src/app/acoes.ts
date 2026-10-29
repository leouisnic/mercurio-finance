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
  const parcelas = Number(dados.get("parcelas") ?? "");

  const alteracoes: Record<string, string | number | null> = {};
  if (apelido) {
    alteracoes.apelido = apelido;
  }
  if (categoria) {
    alteracoes.categoria = categoria;
  }
  if (status) {
    alteracoes.status = status;
  }
  if (status === "parcelamento") {
    alteracoes.parcelas_restantes = parcelas;
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

/**
 * Grava a categoria escolhida para um movimento. Com `alcance=todos`, a
 * escolha vira regra do destinatário e alcança os antigos dele que o
 * Mercúrio classificou sozinho.
 */
export async function classificarMovimento(dados: FormData): Promise<ResultadoDaAcao> {
  const id = String(dados.get("movimento_id"));
  const categoria = String(dados.get("categoria") ?? "");
  if (!categoria) {
    return { erro: "Escolha uma categoria." };
  }

  const motivo = await enviar(`/movimentos/${encodeURIComponent(id)}/categoria`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoria, todos_do_destinatario: dados.get("alcance") === "todos" }),
  });
  if (motivo) {
    return { erro: `Não foi possível salvar a categoria: ${motivo}.` };
  }
  revalidatePath("/movimentos");
  revalidatePath("/");
  return { erro: null };
}

const JSON_HEADERS = { "Content-Type": "application/json" };

function recarregarMovimentos() {
  revalidatePath("/movimentos");
  revalidatePath("/");
}

/** Troca as tags de um movimento. As que não existem são criadas. */
export async function definirTags(movimentoId: number, tags: string[]): Promise<ResultadoDaAcao> {
  const motivo = await enviar(`/movimentos/${movimentoId}/tags`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ tags }),
  });
  if (motivo) {
    return { erro: `Não foi possível salvar as tags: ${motivo}.` };
  }
  recarregarMovimentos();
  return { erro: null };
}

/** A mesma categoria (só para estes, sem virar regra) ou a mesma tag para vários. */
export async function marcarVarios(
  ids: number[],
  marca: { categoria?: string; tag?: string },
): Promise<ResultadoDaAcao> {
  const motivo = await enviar("/movimentos/lote", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ ids, ...marca }),
  });
  if (motivo) {
    return { erro: `Não foi possível marcar os selecionados: ${motivo}.` };
  }
  recarregarMovimentos();
  return { erro: null };
}

/** Cria uma categoria do dono. Devolve o id para a tela já escolhê-la. */
export async function criarCategoria(dados: {
  nome: string;
  icone: string;
  cor: number;
}): Promise<ResultadoDaAcao & { id: string | null }> {
  try {
    const resposta = await fetch(`${FINANCE_API_URL}/categorias`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(dados),
      cache: "no-store",
    });
    if (resposta.status === 422) {
      return { erro: "Já existe uma categoria com esse nome.", id: null };
    }
    if (!resposta.ok) {
      return { erro: `Não foi possível criar a categoria: a API respondeu com erro ${resposta.status}.`, id: null };
    }
    const criada = (await resposta.json()) as { id: string };
    recarregarMovimentos();
    return { erro: null, id: criada.id };
  } catch {
    return { erro: "Não foi possível criar a categoria: a API não respondeu.", id: null };
  }
}

export type DadosDaTag = {
  nome: string;
  icone: string;
  cor: number;
  teto: number | null;
  inicio: string | null;
  fim: string | null;
};

/** Cria uma tag ou, com `id`, altera a que existe. */
export async function salvarTag(dados: DadosDaTag, id?: number): Promise<ResultadoDaAcao> {
  try {
    const resposta = await fetch(`${FINANCE_API_URL}/tags${id ? `/${id}` : ""}`, {
      method: id ? "PATCH" : "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(dados),
      cache: "no-store",
    });
    if (resposta.status === 422) {
      return { erro: "Já existe uma tag com esse nome, ou o período termina antes de começar." };
    }
    if (!resposta.ok) {
      return { erro: `Não foi possível salvar a tag: a API respondeu com erro ${resposta.status}.` };
    }
  } catch {
    return { erro: "Não foi possível salvar a tag: a API não respondeu." };
  }
  recarregarMovimentos();
  revalidatePath("/movimentos/tags");
  return { erro: null };
}

export async function arquivarTag(id: number, arquivada: boolean): Promise<ResultadoDaAcao> {
  const motivo = await enviar(`/tags/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ arquivada }),
  });
  if (motivo) {
    return { erro: `Não foi possível ${arquivada ? "arquivar" : "desarquivar"} a tag: ${motivo}.` };
  }
  revalidatePath("/movimentos/tags");
  return { erro: null };
}

/** Apaga a tag; os movimentos ficam, só perdem a marca. */
export async function apagarTag(id: number): Promise<ResultadoDaAcao> {
  const motivo = await enviar(`/tags/${id}`, { method: "DELETE" });
  if (motivo) {
    return { erro: `Não foi possível apagar a tag: ${motivo}.` };
  }
  recarregarMovimentos();
  revalidatePath("/movimentos/tags");
  return { erro: null };
}
