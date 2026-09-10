import { buscarJson, paraNumero } from "./api";

export const CATEGORIAS = [
  "saude",
  "familia",
  "moradia",
  "assinatura",
  "transporte",
  "alimentacao",
  "outros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];
export type StatusRecorrencia = "pendente" | "aprovada" | "rejeitada";

export const ROTULO_DA_CATEGORIA: Record<Categoria, string> = {
  saude: "Saúde",
  familia: "Família",
  moradia: "Moradia",
  assinatura: "Assinatura",
  transporte: "Transporte",
  alimentacao: "Alimentação",
  outros: "Outros",
};

export type Recorrencia = {
  id: number;
  contaId: string;
  descricao: string;
  apelido: string | null;
  categoria: Categoria | null;
  valorMedio: number;
  ocorrencias: number;
  primeiraData: string;
  ultimaData: string;
  status: StatusRecorrencia;
};

type Linha = {
  id: number;
  conta_id: string;
  descricao: string;
  apelido: string | null;
  categoria: Categoria | null;
  valor_medio: string;
  ocorrencias: number;
  primeira_data: string;
  ultima_data: string;
  status: StatusRecorrencia;
};

/**
 * Padrões de despesa repetida que a detecção encontrou. Sem filtro, vêm
 * todos; a tela pede um status por vez para separar a fila de decisão do
 * que já foi decidido.
 */
export async function buscarRecorrencias(
  status?: StatusRecorrencia,
): Promise<Recorrencia[] | null> {
  const corpo = await buscarJson<Linha[]>("/recorrencias", { status });
  return (
    corpo?.map((linha) => ({
      id: linha.id,
      contaId: linha.conta_id,
      descricao: linha.descricao,
      apelido: linha.apelido,
      categoria: linha.categoria,
      valorMedio: paraNumero(linha.valor_medio),
      ocorrencias: linha.ocorrencias,
      primeiraData: linha.primeira_data,
      ultimaData: linha.ultima_data,
      status: linha.status,
    })) ?? null
  );
}
