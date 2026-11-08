"use client";

import { Tooltip } from "radix-ui";
import { useState, type CSSProperties } from "react";
import { comoData, moeda } from "./formato";

const LETRAS = "DSTQQSS";

/**
 * Número do dia e letra do dia da semana. Dia não útil (fim de semana e
 * feriado) marca só a letra, cheia em magenta, e ao passar o mouse ou tocar
 * diz o que é: o nome do feriado ou "Fim de semana". Hoje ganha o número em
 * destaque.
 */
export function DiaDoEixo({
  data,
  hoje,
  marca,
  escondidoNoCelular = false,
}: {
  data: string;
  hoje: string | null;
  /** O que `marcaDoDia` (em buscar-feriados) devolve para esta data. */
  marca: string | null | undefined;
  escondidoNoCelular?: boolean;
}) {
  const ehHoje = data === hoje;
  const naoUtil = marca !== undefined;
  const feriado = marca ?? null;
  const [aberto, setAberto] = useState(false);
  const dia = (
    <span
      className={`flex flex-col items-center gap-0.5 leading-none ${naoUtil ? "cursor-help" : ""}`}
      aria-hidden
      onClick={naoUtil ? (evento) => { evento.preventDefault(); setAberto(true); } : undefined}
    >
      <span
        className={`num text-xs ${ehHoje ? "bg-marca text-sobre-cor rounded-[5px] px-1 font-bold" : "text-tinta-3"} ${
          escondidoNoCelular && !ehHoje ? "max-sm:invisible" : ""
        }`}
      >
        {data.slice(8, 10)}
      </span>
      <span
        className={`rounded px-1 text-[10px] ${
          naoUtil ? "bg-nao-util text-sobre-nao-util font-bold" : "text-tinta-3"
        }`}
      >
        {LETRAS[comoData(data).getDay()]}
      </span>
    </span>
  );
  if (!naoUtil) return dia;
  // Provedor próprio: o eixo também aparece fora do provedor do layout, nos testes.
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root open={aberto} onOpenChange={setAberto}>
        <Tooltip.Trigger asChild>{dia}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={4}
            collisionPadding={12}
            className="bg-tinta text-superficie z-50 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold"
          >
            {feriado ?? "Fim de semana"}
            <Tooltip.Arrow className="fill-tinta" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * Linha de referência com o valor na ponta direita, pequeno: a cota
 * tracejada e a média pontilhada. Não precisa de legenda, porque o próprio
 * rótulo diz o que é.
 */
function LinhaDeReferencia({
  rotulo,
  valor,
  tracejada,
  style,
}: {
  rotulo: string;
  valor: number;
  tracejada: boolean;
  style: CSSProperties;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 z-10" style={style}>
      <div
        className={
          tracejada
            ? "border-marca border-t-2 border-dashed"
            : "border-tinta-4 border-t-2 border-dotted"
        }
      />
      <span
        className={`num absolute right-0 bottom-[3px] rounded-md px-1.5 text-[10.5px] leading-4 font-bold whitespace-nowrap ${
          tracejada
            ? "bg-marca text-sobre-cor"
            : "bg-superficie text-tinta-2 border-borda border"
        }`}
      >
        {rotulo} {moeda(valor)}
      </span>
    </div>
  );
}

export function LinhaDaCota({
  cota,
  style,
}: {
  cota: number;
  style: CSSProperties;
}) {
  return (
    <LinhaDeReferencia rotulo="Cota" valor={cota} tracejada style={style} />
  );
}

export function LinhaDaMedia({
  media,
  style,
}: {
  media: number;
  style: CSSProperties;
}) {
  return (
    <LinhaDeReferencia
      rotulo="Média"
      valor={media}
      tracejada={false}
      style={style}
    />
  );
}

/**
 * A área dos dias que faltam, com as barras tracejadas no ritmo recente. O
 * total previsto só aparece ao passar o mouse, focar ou tocar, num balão
 * preso à área.
 */
export function AreaDaProjecao({
  style,
  projecao,
  ritmo,
}: {
  style: CSSProperties;
  projecao: number;
  ritmo: number;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <Tooltip.Provider delayDuration={100}>
      <Tooltip.Root open={aberto} onOpenChange={setAberto}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={`Projeção do período: ${moeda(projecao)}`}
            onClick={(evento) => {
              evento.preventDefault();
              setAberto(true);
            }}
            className="hover:bg-marca/5 focus-visible:bg-marca/5 absolute z-[5] cursor-help rounded-lg"
            style={style}
          />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={8}
            collisionPadding={12}
            className="bg-superficie border-borda text-tinta-2 z-50 flex flex-col gap-0.5 rounded-xl border px-3 py-2 text-[12.5px] shadow-lg"
          >
            <b className="text-tinta">Projeção</b>
            <span className="num text-tinta text-[17px] font-bold">
              {moeda(projecao)}
            </span>
            <span className="num">No ritmo de {moeda(ritmo)} por dia</span>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function Amostra({ className }: { className: string }) {
  return (
    <i className={`inline-block size-[11px] rounded-[3px] ${className}`} />
  );
}

/** A legenda dos dois gráficos: só o que não se explica sozinho. */
export function LegendaDosDias({
  comCota,
  foraDaEscala = false,
}: {
  comCota: boolean;
  foraDaEscala?: boolean;
}) {
  return (
    <div
      className="text-tinta-2 flex flex-wrap gap-x-[18px] gap-y-1.5 text-sm"
      aria-hidden
    >
      <span className="flex items-center gap-1.5">
        <Amostra className="bg-caixinha" />
        Dia de ouro
      </span>
      <span className="flex items-center gap-1.5">
        <Amostra className="bg-marca" />
        {comCota ? "Dentro da cota" : "Com gasto"}
      </span>
      {comCota && (
        <span className="flex items-center gap-1.5">
          <Amostra className="bg-alerta-forte" />
          Passou da cota
        </span>
      )}
      {foraDaEscala && (
        <span className="flex items-center gap-1.5">
          <i
            className="inline-block size-[11px] rounded-[3px]"
            style={{
              background:
                "repeating-linear-gradient(135deg, var(--color-alerta-forte) 0 3px, var(--color-superficie) 3px 5px)",
            }}
          />
          Fora da escala
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="bg-nao-util text-sobre-nao-util rounded px-1 text-[10px] leading-4 font-bold">
          S
        </span>
        Dia não útil
      </span>
    </div>
  );
}
