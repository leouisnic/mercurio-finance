import type { CSSProperties } from "react";

// Os gráficos de servidor precisam dos valores, sem atravessar uma fronteira de cliente.
export const LISTRAS_DO_MAIOR_DIA: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklch, var(--color-alerta-forte) 75%, black) 4px 7px)",
};

export const BARRA_DA_PROJECAO: CSSProperties = {
  background:
    "repeating-linear-gradient(135deg, color-mix(in oklch, var(--color-marca) 30%, transparent) 0 3px, transparent 3px 6px)",
  border:
    "1.5px dashed color-mix(in oklch, var(--color-marca) 50%, transparent)",
  borderBottom: 0,
};
