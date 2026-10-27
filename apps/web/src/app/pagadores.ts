/**
 * Nome de quem paga cada ciclo, lido de `PAGADOR_CICLO_1` e
 * `PAGADOR_CICLO_2`. Fica só na configuração local: o repositório é público,
 * e o nome diria para quem o dono trabalha. Sem ele, o ciclo leva o dia do
 * pagamento.
 */
export type Pagadores = { ciclo1: string | null; ciclo2: string | null };

export function lerPagadores(): Pagadores {
  const ler = (valor: string | undefined) => valor?.trim() || null;
  return { ciclo1: ler(process.env.PAGADOR_CICLO_1), ciclo2: ler(process.env.PAGADOR_CICLO_2) };
}

export function pagadorDoCiclo(numero: number, pagadores: Pagadores): string | null {
  return numero === 1 ? pagadores.ciclo1 : pagadores.ciclo2;
}

export function nomeDoCiclo(numero: number, pagadores: Pagadores): string {
  const pagador = pagadorDoCiclo(numero, pagadores);
  return pagador ? `Ciclo ${pagador}` : `Ciclo do dia ${numero === 1 ? 5 : 15}`;
}
