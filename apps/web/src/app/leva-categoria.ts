import type { Movimento } from "./buscar-movimentos";

/**
 * Só receita e despesa levam categoria, e pagamento de fatura não. Fica fora
 * de `buscar-movimentos.ts` porque roda no navegador, e aquele arquivo chama a
 * API com o token, que só existe no servidor.
 */
export function levaCategoria(movimento: Movimento): boolean {
  return (
    ["despesa", "receita"].includes(movimento.tipo) &&
    (movimento.pagamentoDeFatura === null ||
      movimento.pagamentoDeFatura === "descartado")
  );
}
