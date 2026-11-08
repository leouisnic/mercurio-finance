"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { type ClassNames, type DateRange, DayPicker } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { comoData } from "./formato";

/**
 * O calendário do Mercúrio, no lugar do calendário nativo do navegador. Um
 * componente só para o filtro de datas, o cadastro de feriado e o período da
 * tag. Fim de semana em magenta, como no eixo dos gráficos; hoje com contorno.
 */

const CLASSES: Partial<ClassNames> = {
  root: "text-tinta text-[13px]",
  months: "relative flex flex-col",
  month: "flex flex-col gap-2",
  month_caption: "flex h-8 items-center justify-center font-bold",
  caption_label: "first-letter:uppercase",
  nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
  button_previous:
    "text-tinta-2 hover:bg-superficie-2 grid size-8 place-items-center rounded-lg",
  button_next:
    "text-tinta-2 hover:bg-superficie-2 grid size-8 place-items-center rounded-lg",
  month_grid: "border-collapse",
  weekdays: "",
  weekday: "text-tinta-3 h-7 w-9 text-[11px] font-semibold uppercase",
  week: "",
  day: "p-0 text-center",
  day_button:
    "hover:bg-superficie-2 focus-visible:outline-marca num grid size-9 place-items-center rounded-[9px] text-[12.5px] focus-visible:outline-2",
  selected:
    "[&>button]:bg-marca [&>button]:text-sobre-cor [&>button]:font-bold",
  range_middle:
    "[&>button]:!bg-marca-clara [&>button]:!text-marca [&>button]:!font-semibold [&>button]:rounded-none",
  range_start: "",
  range_end: "",
  today: "[&>button]:ring-marca [&>button]:ring-[1.5px] [&>button]:ring-inset",
  outside: "text-tinta-4",
  disabled: "text-tinta-4 opacity-50",
};

const FIM_DE_SEMANA = { naoUtil: { dayOfWeek: [0, 6] } };
const MARCAS = { naoUtil: "text-nao-util font-semibold" };

function Seta({
  orientation,
}: {
  orientation?: "left" | "right" | "up" | "down";
}) {
  return orientation === "left" ? (
    <ChevronLeft size={16} aria-hidden="true" />
  ) : (
    <ChevronRight size={16} aria-hidden="true" />
  );
}

const iso = (data: Date) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
const DIA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});
const DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function atalhos(hoje: Date): { rotulo: string; de: Date; ate: Date }[] {
  const dias = (n: number) =>
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
  return [
    { rotulo: "Hoje", de: hoje, ate: hoje },
    { rotulo: "Ontem", de: dias(1), ate: dias(1) },
    { rotulo: "Últimos 7 dias", de: dias(6), ate: hoje },
    { rotulo: "Últimos 30 dias", de: dias(29), ate: hoje },
    {
      rotulo: "Este mês",
      de: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
      ate: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0),
    },
    {
      rotulo: "Mês passado",
      de: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
      ate: new Date(hoje.getFullYear(), hoje.getMonth(), 0),
    },
  ];
}

/**
 * Intervalo de datas: atalhos em etiquetas no topo, o mês, e embaixo o
 * intervalo escolhido com Limpar e Aplicar. Datas em ISO (AAAA-MM-DD).
 */
export function CalendarioDeIntervalo({
  de,
  ate,
  hoje,
  aplicar,
}: {
  de?: string;
  ate?: string;
  hoje: string;
  aplicar: (de: string, ate: string) => void;
}) {
  const [intervalo, setIntervalo] = useState<DateRange | undefined>(
    de && ate ? { from: comoData(de), to: comoData(ate) } : undefined,
  );
  const dataDeHoje = comoData(hoje);
  const [mes, setMes] = useState<Date>(intervalo?.from ?? dataDeHoje);
  const completo = intervalo?.from && intervalo.to;
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex max-w-[260px] flex-wrap gap-1.5"
        role="group"
        aria-label="Atalhos de período"
      >
        {atalhos(dataDeHoje).map((atalho) => {
          const ativo =
            intervalo?.from &&
            intervalo.to &&
            iso(intervalo.from) === iso(atalho.de) &&
            iso(intervalo.to) === iso(atalho.ate);
          return (
            <button
              key={atalho.rotulo}
              type="button"
              aria-pressed={Boolean(ativo)}
              onClick={() => {
                setIntervalo({ from: atalho.de, to: atalho.ate });
                setMes(atalho.de);
              }}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${
                ativo
                  ? "bg-marca text-sobre-cor border-transparent"
                  : "border-borda text-tinta-2 hover:bg-superficie-2"
              }`}
            >
              {atalho.rotulo}
            </button>
          );
        })}
      </div>
      <DayPicker
        mode="range"
        locale={ptBR}
        selected={intervalo}
        onSelect={setIntervalo}
        month={mes}
        onMonthChange={setMes}
        today={dataDeHoje}
        classNames={CLASSES}
        modifiers={FIM_DE_SEMANA}
        modifiersClassNames={MARCAS}
        components={{ Chevron: Seta }}
      />
      <div className="border-borda-sutil flex items-center justify-between gap-2 border-t pt-2.5">
        <span className="num text-tinta-2 text-[12.5px]">
          {intervalo?.from
            ? `${DIA.format(intervalo.from)} a ${intervalo.to ? DIA.format(intervalo.to) : "…"}`
            : "Escolha o início"}
        </span>
        <span className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setIntervalo(undefined)}
            className="border-borda text-tinta-2 hover:bg-superficie-2 rounded-[9px] border px-2.5 py-1.5 text-[12.5px]"
          >
            Limpar
          </button>
          <button
            type="button"
            disabled={!completo}
            onClick={() =>
              intervalo?.from &&
              intervalo.to &&
              aplicar(iso(intervalo.from), iso(intervalo.to))
            }
            className="bg-marca text-sobre-cor hover:bg-marca-escura rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold disabled:opacity-60"
          >
            Aplicar
          </button>
        </span>
      </div>
    </div>
  );
}

/** Um campo de data que abre o calendário do Mercúrio. `valor` em ISO, ou vazio. */
export function CampoDeData({
  valor,
  mudar,
  rotulo,
  hoje,
  minimo,
}: {
  valor: string;
  mudar: (valor: string) => void;
  rotulo: string;
  hoje: string;
  minimo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const escolhida = valor ? comoData(valor) : undefined;
  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${rotulo}: ${escolhida ? DATA.format(escolhida) : "escolher"}`}
          className="border-borda hover:border-tinta-4 bg-superficie flex items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left text-[13.5px]"
        >
          <CalendarDays size={15} aria-hidden="true" className="text-tinta-3" />
          <span className={escolhida ? "num" : "text-tinta-3"}>
            {escolhida ? DATA.format(escolhida) : "Escolher data"}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label={rotulo}
          className="bg-superficie border-borda z-50 rounded-2xl border p-3 shadow-xl"
        >
          <DayPicker
            mode="single"
            locale={ptBR}
            selected={escolhida}
            onSelect={(data) => {
              if (data) {
                mudar(iso(data));
                setAberto(false);
              }
            }}
            defaultMonth={escolhida ?? comoData(hoje)}
            today={comoData(hoje)}
            disabled={minimo ? { before: comoData(minimo) } : undefined}
            classNames={CLASSES}
            modifiers={FIM_DE_SEMANA}
            modifiersClassNames={MARCAS}
            components={{ Chevron: Seta }}
          />
          {valor && (
            <button
              type="button"
              onClick={() => { mudar(""); setAberto(false); }}
              className="text-tinta-2 hover:bg-superficie-2 mt-2 rounded-lg px-2.5 py-1.5 text-[12.5px]"
            >
              Limpar data
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
