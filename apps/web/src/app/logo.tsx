/** Marca do Vértice: o mesmo desenho de design/vertice/logo.svg. */
export function Logo({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" aria-hidden>
      <g fill="white">
        <path d="M20 100 L20 80 Q20 70 30 68 L70 68 Q80 70 80 80 L80 100 Z" />
        <path d="M42 62 L42 74 L58 74 L58 62 Z" />
        <ellipse cx="50" cy="46" rx="19" ry="22" />
        <ellipse cx="80" cy="24" rx="20.5" ry="7.4" transform="rotate(-44 80 24)" />
        <ellipse cx="75" cy="33" rx="12.8" ry="6.2" transform="rotate(-28 75 33)" />
        <g transform="translate(100,0) scale(-1,1)">
          <ellipse cx="80" cy="24" rx="20.5" ry="7.4" transform="rotate(-44 80 24)" />
          <ellipse cx="75" cy="33" rx="12.8" ry="6.2" transform="rotate(-28 75 33)" />
        </g>
      </g>
      <line x1="33" y1="40" x2="67" y2="40" stroke="oklch(48% 0.16 265)" strokeWidth="2.6" />
    </svg>
  );
}
