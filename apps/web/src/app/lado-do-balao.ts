"use client";

import { useRef, useState } from "react";

/**
 * Lado e posição do balão, escolhidos uma vez, ao abrir: para cima ou para
 * baixo pelo espaço que sobra, e deslocado na horizontal para não passar da
 * borda da tela. Com o balão aberto nada muda. Com a
 * colisão do Radix ligada, rolar a página trocava o balão de lado debaixo do
 * dedo; por isso ela vai desligada (`avoidCollisions={false}`) e este gancho
 * faz a conta que ela fazia, uma vez só, inclusive a altura máxima, que o
 * Radix sem colisão deixa de limitar.
 */
export function useLadoDoBalao(alturaDesejada = 420, larguraDoBalao = 380) {
  const gatilho = useRef<HTMLButtonElement>(null);
  const [lado, setLado] = useState<"top" | "bottom">("bottom");
  const [deslocamento, setDeslocamento] = useState(0);
  const [alturaMaxima, setAlturaMaxima] = useState(alturaDesejada);

  function decidir() {
    const caixa = gatilho.current?.getBoundingClientRect();
    if (!caixa) return;
    const embaixo = window.innerHeight - caixa.bottom;
    const paraBaixo = embaixo >= alturaDesejada || embaixo >= caixa.top;
    setLado(paraBaixo ? "bottom" : "top");
    // 20 px: a distância do botão (8) mais a margem da borda da tela (12).
    setAlturaMaxima(
      Math.min(alturaDesejada, (paraBaixo ? embaixo : caixa.top) - 20),
    );
    // Preso à esquerda do botão e empurrado para dentro da tela quando não cabe,
    // como o deslocamento que a colisão do Radix fazia.
    const largura = Math.min(larguraDoBalao, window.innerWidth - 24);
    const esquerda = Math.min(
      Math.max(caixa.left, 12),
      window.innerWidth - 12 - largura,
    );
    setDeslocamento(esquerda - caixa.left);
  }

  return { gatilho, lado, deslocamento, alturaMaxima, decidir };
}
