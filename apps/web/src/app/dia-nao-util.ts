/**
 * Fim de semana e feriado nos gráficos. Fica fora do arquivo de busca porque roda no navegador, e aquele arquivo
 * chama a API com o token, que só existe no servidor.
 */

/** Fim de semana e feriado do intervalo; `feriado` é o nome, ou null no fim de semana. */
export type DiaNaoUtil = { data: string; feriado: string | null };

/** O dia na lista de não úteis: undefined se é dia útil, null se é fim de semana, o nome se é feriado. */
export function marcaDoDia(
  naoUteis: DiaNaoUtil[],
  data: string,
): string | null | undefined {
  const dia = naoUteis.find((item) => item.data === data);
  return dia ? dia.feriado : undefined;
}
