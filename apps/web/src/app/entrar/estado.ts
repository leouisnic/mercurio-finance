/** O que a tela de entrada mostra depois de uma tentativa. */
export type EstadoDaEntrada = {
  erro: string | null;
  esperaMinutos: number;
};

export const ENTRADA_INICIAL: EstadoDaEntrada = { erro: null, esperaMinutos: 0 };
