/**
 * Contas do gráfico de gasto por dia que não pedem a API: a média do
 * período, o maior dia e a projeção no ritmo recente. Os dias passados
 * contam também os sem gasto.
 */

export type DiaDoGrafico = { data: string; valor: number };

/** Gasto médio por dia passado, incluindo os dias sem gasto. */
export function mediaPorDia(passados: DiaDoGrafico[]): number | null {
  if (passados.length === 0) return null;
  return passados.reduce((soma, dia) => soma + dia.valor, 0) / passados.length;
}

/** A data do maior dia, se algum dia teve gasto. */
export function maiorDia(passados: DiaDoGrafico[]): string | null {
  const maior = passados.reduce<DiaDoGrafico | null>(
    (atual, dia) => (dia.valor > (atual?.valor ?? 0) ? dia : atual),
    null,
  );
  return maior?.data ?? null;
}

/**
 * Projeção do fim do período no ritmo dos últimos 7 dias passados (ou de
 * quantos houver). Sem dias faltando, não há projeção.
 */
export function projecao(
  passados: DiaDoGrafico[],
  diasQueFaltam: number,
): { ritmo: number; total: number } | null {
  if (diasQueFaltam <= 0 || passados.length === 0) return null;
  const recentes = passados.slice(-7);
  const ritmo =
    recentes.reduce((soma, dia) => soma + dia.valor, 0) / recentes.length;
  const gasto = passados.reduce((soma, dia) => soma + dia.valor, 0);
  return { ritmo, total: gasto + ritmo * diasQueFaltam };
}
