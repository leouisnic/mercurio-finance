/**
 * O dia financeiro da tela, em AAAA-MM-DD.
 *
 * `MERCURIO_HOJE` fixa a data na demonstração e no e2e: a base fictícia tem
 * datas fixas de agosto de 2026, e fora delas o ciclo corrente sairia vazio.
 * A idade da sincronização continua no relógio de verdade.
 */
export function dataDeHoje(): string {
  const fixa = process.env.MERCURIO_HOJE?.trim();
  if (fixa && /^\d{4}-\d{2}-\d{2}$/.test(fixa)) {
    return fixa;
  }
  const agora = new Date();
  const doisDigitos = (valor: number) => String(valor).padStart(2, "0");
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
}
