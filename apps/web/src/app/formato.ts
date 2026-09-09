/** Formatação compartilhada pelas telas. Tudo em pt-BR. */

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DIA_POR_EXTENSO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function moeda(valor: number): string {
  return MOEDA.format(valor);
}

/**
 * Data ISO (AAAA-MM-DD) como objeto local. `new Date("2026-09-04")` é lido
 * como UTC e, num fuso negativo, volta um dia; por isso o construtor por
 * partes.
 */
export function comoData(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

export function diaEMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export function porExtenso(data: Date): string {
  return DIA_POR_EXTENSO.format(data);
}

export function diasEntre(de: Date, ate: Date): number {
  const umDia = 24 * 60 * 60 * 1000;
  return Math.round((ate.getTime() - de.getTime()) / umDia);
}

/** "há 2 min", "há 3 h", "há 4 dias". */
export function tempoDesde(iso: string, agora: Date): string {
  const minutos = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60000));
  if (minutos < 60) {
    return `há ${minutos} min`;
  }
  const horas = Math.round(minutos / 60);
  return horas < 24 ? `há ${horas} h` : `há ${Math.round(horas / 24)} dias`;
}
