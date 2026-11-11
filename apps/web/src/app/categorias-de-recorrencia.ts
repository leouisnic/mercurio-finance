/**
 * Categorias pessoais da recorrência. Fica fora do arquivo de busca porque roda no navegador, e aquele arquivo
 * chama a API com o token, que só existe no servidor.
 */

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

export const ROTULO_DA_CATEGORIA: Record<Categoria, string> = {
  saude: "Saúde",
  familia: "Família",
  moradia: "Moradia",
  assinatura: "Assinatura",
  transporte: "Transporte",
  alimentacao: "Alimentação",
  outros: "Outros",
};
