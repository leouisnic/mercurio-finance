"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { apagarFeriado, salvarFeriado } from "../acoes";
import type { Feriado } from "../buscar-feriados";
import { comoData } from "../formato";
import { CampoDeData } from "../calendario";

const MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const DIA_E_MES = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
});

/** Quem paga cada ciclo, já com o nome do `.env.local` ou o genérico. */
export type NomesDosPagadores = { ciclo1: string; ciclo2: string };

/** "Muda o pagamento de X", "Muda os dois pagamentos" ou "Só marca no gráfico". */
export function efeitoDoFeriado(
  feriado: Pick<Feriado, "mudaCiclo1" | "mudaCiclo2">,
  nomes: NomesDosPagadores,
): string {
  if (feriado.mudaCiclo1 && feriado.mudaCiclo2)
    return "Muda os dois pagamentos";
  if (feriado.mudaCiclo1) return `Muda o pagamento de ${nomes.ciclo1}`;
  if (feriado.mudaCiclo2) return `Muda o pagamento de ${nomes.ciclo2}`;
  return "Só marca no gráfico";
}

function BlocoDeData({ data }: { data: string }) {
  const dia = comoData(data);
  return (
    <span className="bg-marca-clara text-marca flex h-[50px] w-[46px] shrink-0 flex-col items-center justify-center rounded-xl leading-none">
      <b className="text-[19px]">{dia.getDate()}</b>
      <span className="mt-0.5 text-[11px] font-bold uppercase">
        {MES_CURTO.format(dia).replace(".", "")}
      </span>
    </span>
  );
}

function LinhaDoFeriado({
  feriado,
  nomes,
  editar,
}: {
  feriado: Feriado;
  nomes: NomesDosPagadores;
  editar: () => void;
}) {
  const [apagando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const muda = feriado.mudaCiclo1 || feriado.mudaCiclo2;
  return (
    <li className="border-borda-sutil bg-superficie hover:bg-superficie-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[14px] border px-3 py-2.5">
      <BlocoDeData data={feriado.data} />
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-[14px]">{feriado.nome}</b>
        <span className="text-tinta-3 text-[12px]">
          {feriado.repeteTodoAno
            ? "Todo ano"
            : `Só em ${feriado.data.slice(0, 4)}`}
        </span>
      </span>
      <span
        className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${muda ? "bg-marca-clara text-marca" : "bg-borda-sutil text-tinta-2"}`}
      >
        {efeitoDoFeriado(feriado, nomes)}
      </span>
      <span className="flex">
        <button
          type="button"
          onClick={editar}
          aria-label={`Editar ${feriado.nome}`}
          className="text-tinta-3 hover:bg-borda-sutil hover:text-tinta grid size-8 place-items-center rounded-lg"
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={apagando}
          onClick={() =>
            iniciar(async () => {
              setErro((await apagarFeriado(feriado.id)).erro);
            })
          }
          aria-label={`Apagar ${feriado.nome}`}
          className="text-tinta-3 hover:bg-alerta-fundo hover:text-alerta grid size-8 place-items-center rounded-lg disabled:opacity-60"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </span>
      {erro && (
        <p role="alert" className="text-alerta w-full text-[12.5px]">
          {erro}
        </p>
      )}
    </li>
  );
}

function CartaoDePagador({
  marcado,
  mudar,
  nome,
  detalhe,
}: {
  marcado: boolean;
  mudar: (marcado: boolean) => void;
  nome: string;
  detalhe: string;
}) {
  return (
    <label className="border-borda has-checked:border-marca has-checked:bg-marca-clara hover:border-tinta-4 flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(evento) => mudar(evento.target.checked)}
        aria-label={`${nome}, ${detalhe}`}
        className="accent-marca mt-0.5 size-4"
      />
      <span className="flex flex-col">
        <b className="text-[13.5px]">{nome}</b>
        <span className="text-tinta-3 text-[12px]">{detalhe}</span>
      </span>
    </label>
  );
}

const VAZIO = {
  nome: "",
  data: "",
  repete: true,
  ciclo1: false,
  ciclo2: false,
};

export function Feriados({
  feriados,
  nomes,
  nacionais,
  hoje,
}: {
  feriados: Feriado[];
  nomes: NomesDosPagadores;
  nacionais: { data: string; nome: string }[];
  hoje: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [campos, setCampos] = useState(VAZIO);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(
    null,
  );
  const [enviando, iniciar] = useTransition();
  const mudar = (novo: Partial<typeof VAZIO>) =>
    setCampos((atual) => ({ ...atual, ...novo }));

  function abrirNovo() {
    setCampos(VAZIO);
    setEditando(null);
    setAviso(null);
    setAberto(true);
  }

  function abrirEdicao(feriado: Feriado) {
    setCampos({
      nome: feriado.nome,
      data: feriado.data,
      repete: feriado.repeteTodoAno,
      ciclo1: feriado.mudaCiclo1,
      ciclo2: feriado.mudaCiclo2,
    });
    setEditando(feriado.id);
    setAviso(null);
    setAberto(true);
  }

  function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    iniciar(async () => {
      const resultado = await salvarFeriado(
        {
          nome: campos.nome.trim(),
          data: campos.data,
          repete_todo_ano: campos.repete,
          muda_ciclo_1: campos.ciclo1,
          muda_ciclo_2: campos.ciclo2,
        },
        editando ?? undefined,
      );
      if (resultado.erro) {
        setAviso({ erro: true, texto: resultado.erro });
        return;
      }
      setAberto(false);
      setEditando(null);
      setCampos(VAZIO);
      setAviso(
        resultado.mudaCicloPassado
          ? {
              erro: false,
              texto:
                "Feriado salvo. Ele mudou o dia de pagamento de um ciclo que já passou: o gasto daquele dia pode ter trocado de ciclo.",
            }
          : { erro: false, texto: "Feriado salvo." },
      );
    });
  }

  const campo =
    "border-borda focus:border-marca hover:border-tinta-4 rounded-[10px] border bg-superficie px-2.5 py-2 text-[13.5px] outline-none";

  return (
    <section
      aria-label="Feriados"
      className="bg-superficie border-borda flex min-w-0 flex-col gap-4 rounded-2xl border p-4 md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <h2 className="text-[17px] font-bold">Feriados</h2>
          <span className="text-tinta-2 text-[13px]">
            Feriado da cidade de quem paga muda o dia do pagamento e, com ele, o
            ciclo.
          </span>
        </span>
        {!aberto && (
          <button
            type="button"
            onClick={abrirNovo}
            className="bg-marca text-sobre-cor hover:bg-marca-escura inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-bold"
          >
            <Plus size={15} aria-hidden="true" /> Novo feriado
          </button>
        )}
      </div>

      {aviso && (
        <p
          role={aviso.erro ? "alert" : "status"}
          className={`rounded-[9px] px-3 py-2 text-[13px] ${aviso.erro ? "bg-alerta-fundo text-alerta" : "bg-marca-clara text-marca"}`}
        >
          {aviso.texto}
        </p>
      )}

      {aberto && (
        <form
          onSubmit={salvar}
          aria-label={editando ? "Editar feriado" : "Novo feriado"}
          className="bg-superficie-2 border-borda flex flex-col gap-3 rounded-[14px] border border-dashed p-4"
        >
          <b className="text-[14px]">
            {editando ? "Editar feriado" : "Novo feriado"}
          </b>
          <div className="grid gap-2.5 sm:grid-cols-[1fr_170px]">
            <label className="flex flex-col gap-1">
              <span className="text-tinta-2 text-[12.5px] font-semibold">
                Nome
              </span>
              <input
                value={campos.nome}
                onChange={(evento) => mudar({ nome: evento.target.value })}
                required
                maxLength={60}
                className={campo}
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-tinta-2 text-[12.5px] font-semibold">
                Data
              </span>
              <CampoDeData
                valor={campos.data}
                mudar={(data) => mudar({ data })}
                rotulo="Data"
                hoje={hoje}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={campos.repete}
              onChange={(evento) => mudar({ repete: evento.target.checked })}
              className="accent-marca size-4"
            />
            Repete todo ano
          </label>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="text-tinta-2 mb-1 text-[12.5px] font-semibold">
              Muda o dia de pagamento de
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <CartaoDePagador
                marcado={campos.ciclo1}
                mudar={(ciclo1) => mudar({ ciclo1 })}
                nome={nomes.ciclo1}
                detalhe="Paga o ciclo 1, dia 5"
              />
              <CartaoDePagador
                marcado={campos.ciclo2}
                mudar={(ciclo2) => mudar({ ciclo2 })}
                nome={nomes.ciclo2}
                detalhe="Paga o ciclo 2, dia 15"
              />
            </div>
            <span className="text-tinta-3 text-[12.5px]">
              Sem marcar nenhum, o feriado só aparece nos gráficos e nos
              contadores.
            </span>
          </fieldset>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                setEditando(null);
              }}
              className="border-borda text-tinta-2 hover:bg-superficie rounded-[10px] border px-3.5 py-2 text-[13px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !campos.nome.trim() || !campos.data}
              className="bg-marca text-sobre-cor hover:bg-marca-escura rounded-[10px] px-3.5 py-2 text-[13px] font-bold disabled:opacity-60"
            >
              {enviando ? "Salvando" : "Salvar feriado"}
            </button>
          </div>
        </form>
      )}

      {feriados.length === 0 ? (
        <p className="text-tinta-3 text-[13px]">
          Nenhum feriado da cidade cadastrado.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {feriados.map((feriado) => (
            <LinhaDoFeriado
              key={feriado.id}
              feriado={feriado}
              nomes={nomes}
              editar={() => abrirEdicao(feriado)}
            />
          ))}
        </ul>
      )}

      {nacionais.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-tinta-2 text-[12.5px] font-bold">
            Nacionais, automáticos, mudam os dois pagamentos
          </span>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {nacionais.map((nacional) => (
              <li
                key={nacional.data}
                className="bg-borda-sutil text-tinta-2 rounded-full px-2.5 py-1 text-[12px]"
              >
                {DIA_E_MES.format(comoData(nacional.data)).replace(".", "")} ·{" "}
                {nacional.nome}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
