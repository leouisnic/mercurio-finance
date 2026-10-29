"use client";

import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Ellipsis,
  Palette,
  Pencil,
  Plus,
  ReceiptText,
  Target,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { apagarTag, arquivarTag, type DadosDaTag, salvarTag } from "../acoes";
import type { Tag } from "../buscar-movimentos";
import { moeda, periodoPorExtenso } from "../formato";
import { Info } from "../info";
import {
  CORES_PARA_CRIAR,
  ICONES_DE_TAG,
  IconeDaCategoria,
} from "./icones";
import type { CSSProperties } from "react";

const TETOS = [1000, 3000, 6000];

function isoDe(data: Date): string {
  const doisDigitos = (valor: number) => String(valor).padStart(2, "0");
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

/** Janela que sobe de baixo no celular e fica no meio da tela no computador. */
export function Janela({
  titulo,
  fechar,
  children,
}: {
  titulo: string;
  fechar: () => void;
  children: ReactNode;
}) {
  const janela = useRef<HTMLDivElement>(null);
  useEffect(() => {
    janela.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);
  return (
    <>
      <div
        aria-hidden="true"
        onClick={fechar}
        className="bg-tinta/30 fixed inset-0 z-40"
      />
      <div
        ref={janela}
        role="dialog"
        aria-label={titulo}
        onKeyDown={(evento) => evento.key === "Escape" && fechar()}
        className="bg-superficie border-borda fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col gap-3 overflow-y-auto rounded-t-2xl border p-5 shadow-xl md:inset-auto md:top-1/2 md:left-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
      >
        <strong className="text-[15px]">{titulo}</strong>
        {children}
      </div>
    </>
  );
}

function Atalho({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12.5px] ${
        ativo
          ? "border-marca bg-marca-clara text-marca font-bold"
          : "border-borda text-tinta-2 hover:border-marca hover:bg-superficie-2"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Criar ou editar tag: prévia, ícone e cor, teto e período. Teto e período
 * são opcionais; os atalhos cobrem o comum e "Outro valor" e "Escolher datas"
 * abrem o campo.
 */
export function FormularioDeTag({
  tag,
  fechar,
}: {
  tag?: Tag;
  fechar: () => void;
}) {
  const hoje = new Date();
  const [nome, setNome] = useState(tag?.nome ?? "");
  const [icone, setIcone] = useState(tag?.icone ?? "Plane");
  const [cor, setCor] = useState(tag?.cor ?? CORES_PARA_CRIAR[4]);
  const [teto, setTeto] = useState<number | null>(tag?.teto ?? null);
  const [outroTeto, setOutroTeto] = useState(
    tag?.teto !== null && tag?.teto !== undefined && !TETOS.includes(tag.teto),
  );
  const [inicio, setInicio] = useState(tag?.inicio ?? "");
  const [fim, setFim] = useState(tag?.fim ?? "");
  const [datasAbertas, setDatasAbertas] = useState(
    Boolean(tag?.inicio || tag?.fim),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function periodo(de: string, ate: string, abrir = false) {
    setInicio(de);
    setFim(ate);
    setDatasAbertas(abrir);
  }

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    const dados: DadosDaTag = {
      nome: nome.trim(),
      icone,
      cor,
      teto,
      inicio: inicio || null,
      fim: fim || null,
    };
    iniciar(async () => {
      const { erro } = await salvarTag(dados, tag?.id);
      setErro(erro);
      if (!erro) fechar();
    });
  }

  const resumo = periodoPorExtenso(inicio || null, fim || null);
  const fimDoMes = isoDe(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  const daquiASete = isoDe(
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 6),
  );

  return (
    <Janela titulo={tag ? "Editar tag" : "Nova tag"} fechar={fechar}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        {/* A prévia é o próprio cartão da página Tags. */}
        <div className="border-borda overflow-hidden rounded-xl border">
          <div
            className="categoria-bola flex items-center gap-2 px-3 py-2"
            style={{ "--tom": cor } as CSSProperties}
          >
            <IconeDaCategoria nome={icone} tamanho={17} />
            <b className="text-tinta truncate text-[14px]">
              {nome.trim() || "Nome da tag"}
            </b>
          </div>
          <div className="text-tinta-2 flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-[12.5px]">
            <span className="inline-flex items-center gap-1">
              <ReceiptText size={13} aria-hidden="true" />{" "}
              {tag ? `${tag.quantidade} movimentos` : "nenhum movimento ainda"}
            </span>
            {resumo && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={13} aria-hidden="true" /> {resumo}
              </span>
            )}
            {teto !== null && (
              <span className="inline-flex items-center gap-1">
                <Target size={13} aria-hidden="true" /> teto{" "}
                {moeda(teto).replace(",00", "")}
              </span>
            )}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-tinta-2 text-[12.5px] font-semibold">Nome</span>
          <input
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            required
            maxLength={60}
            placeholder="viagem, reforma, aniversário"
            className="border-borda focus:border-marca hover:border-tinta-4 rounded-[10px] border bg-transparent px-2.5 py-2 text-[13.5px] outline-none"
          />
        </label>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="text-tinta-2 mb-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Palette size={14} aria-hidden="true" /> Ícone e cor
          </legend>
          <div className="grid grid-cols-6 gap-1.5">
            {ICONES_DE_TAG.map((nomeDoIcone) => (
              <label
                key={nomeDoIcone}
                className="border-borda text-tinta-2 hover:bg-superficie-2 hover:border-tinta-4 has-checked:border-marca has-checked:bg-marca-clara has-checked:text-marca has-focus-visible:outline-marca grid h-10 cursor-pointer place-items-center rounded-[10px] border has-focus-visible:outline-2"
              >
                <input
                  type="radio"
                  name="icone"
                  checked={icone === nomeDoIcone}
                  onChange={() => setIcone(nomeDoIcone)}
                  aria-label={nomeDoIcone}
                  className="sr-only"
                />
                <IconeDaCategoria nome={nomeDoIcone} tamanho={18} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {CORES_PARA_CRIAR.map((tom) => (
              // O contorno vai no próprio círculo, do tamanho dele: no rótulo,
              // a altura da linha deixava o contorno oval e sobrando.
              <label
                key={tom}
                className="group inline-grid size-7 cursor-pointer place-items-center rounded-full"
              >
                <input
                  type="radio"
                  name="cor"
                  checked={cor === tom}
                  onChange={() => setCor(tom)}
                  aria-label={`Cor ${tom}`}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="categoria-bola peer-checked:outline-marca peer-focus-visible:outline-marca block size-7 rounded-full outline-offset-2 transition-transform group-hover:scale-110 peer-checked:outline-2 peer-focus-visible:outline-2"
                  style={{ "--tom": tom } as CSSProperties}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-tinta-2 mb-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Target size={14} aria-hidden="true" /> Teto
          </legend>
          <div className="flex flex-wrap gap-1.5">
            <Atalho
              ativo={teto === null && !outroTeto}
              onClick={() => {
                setTeto(null);
                setOutroTeto(false);
              }}
            >
              Sem teto
            </Atalho>
            {TETOS.map((valor) => (
              <Atalho
                key={valor}
                ativo={!outroTeto && teto === valor}
                onClick={() => {
                  setTeto(valor);
                  setOutroTeto(false);
                }}
              >
                {moeda(valor).replace(",00", "")}
              </Atalho>
            ))}
            <Atalho ativo={outroTeto} onClick={() => setOutroTeto(true)}>
              Outro valor
            </Atalho>
          </div>
          {outroTeto && (
            <label className="border-borda focus-within:border-marca hover:border-tinta-4 flex items-center gap-2 rounded-[10px] border px-2.5">
              <span className="text-tinta-3 text-[13.5px]">R$</span>
              <input
                type="number"
                min={100}
                step={100}
                inputMode="decimal"
                aria-label="Valor do teto"
                value={teto ?? ""}
                onChange={(evento) =>
                  setTeto(
                    evento.target.value ? Number(evento.target.value) : null,
                  )
                }
                className="min-w-0 flex-1 bg-transparent py-2 text-[13.5px] outline-none"
              />
            </label>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-tinta-2 mb-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
            <CalendarDays size={14} aria-hidden="true" /> Período
            <Info
              sobre="período da tag"
              texto="Com período, o modo viagem vai poder marcar sozinho o que chegar nessas datas."
            />
          </legend>
          <div className="flex flex-wrap gap-1.5">
            <Atalho
              ativo={!inicio && !fim && !datasAbertas}
              onClick={() => periodo("", "")}
            >
              Sem período
            </Atalho>
            <Atalho
              ativo={
                !datasAbertas && inicio === isoDe(hoje) && fim === daquiASete
              }
              onClick={() => periodo(isoDe(hoje), daquiASete)}
            >
              Próximos 7 dias
            </Atalho>
            <Atalho
              ativo={
                !datasAbertas &&
                fim === fimDoMes &&
                inicio.slice(0, 7) === fimDoMes.slice(0, 7) &&
                inicio.endsWith("-01")
              }
              onClick={() => periodo(`${fimDoMes.slice(0, 8)}01`, fimDoMes)}
            >
              Este mês
            </Atalho>
            <Atalho ativo={datasAbertas} onClick={() => setDatasAbertas(true)}>
              Escolher datas
            </Atalho>
          </div>
          {datasAbertas && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-tinta-3 text-[12px]">De</span>
                <input
                  type="date"
                  value={inicio}
                  onChange={(evento) => setInicio(evento.target.value)}
                  className="border-borda hover:border-tinta-4 rounded-[10px] border bg-transparent px-2.5 py-2 text-[13.5px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-tinta-3 text-[12px]">Até</span>
                <input
                  type="date"
                  value={fim}
                  min={inicio || undefined}
                  onChange={(evento) => setFim(evento.target.value)}
                  className="border-borda hover:border-tinta-4 rounded-[10px] border bg-transparent px-2.5 py-2 text-[13.5px]"
                />
              </label>
            </div>
          )}
        </fieldset>

        {erro && (
          <p
            role="alert"
            className="bg-alerta-fundo text-alerta rounded-[9px] px-3 py-2 text-[13px]"
          >
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={fechar}
            className="border-borda text-tinta-2 hover:bg-superficie-2 rounded-[10px] border px-3.5 py-2 text-[13px]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || !nome.trim()}
            className="bg-marca text-sobre-cor hover:bg-marca-escura rounded-[10px] px-3.5 py-2 text-[13px] font-bold disabled:opacity-60"
          >
            {enviando ? "Salvando" : tag ? "Salvar" : "Criar tag"}
          </button>
        </div>
      </form>
    </Janela>
  );
}

export function BotaoNovaTag() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="bg-marca text-sobre-cor hover:bg-marca-escura inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-bold transition-colors"
      >
        <Plus size={16} aria-hidden="true" /> Nova tag
      </button>
      {aberto && <FormularioDeTag fechar={() => setAberto(false)} />}
    </>
  );
}

/**
 * Editar, arquivar e apagar. Apagar pede confirmação na própria tela, nunca
 * na caixa do navegador. `depoisDeApagar` leva para onde a tag não existe mais.
 */
export function AcoesDaTag({
  tag,
  compacto = false,
  depoisDeApagar,
}: {
  tag: Tag;
  compacto?: boolean;
  depoisDeApagar?: string;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function executar(
    acao: () => Promise<{ erro: string | null }>,
    depois?: () => void,
  ) {
    iniciar(async () => {
      const { erro } = await acao();
      setErro(erro);
      if (!erro) {
        setMenu(false);
        setConfirmando(false);
        depois?.();
      }
    });
  }

  const botao =
    "border-borda bg-superficie hover:bg-superficie-2 hover:border-tinta-4 inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[13px]";
  const acoes = (
    <>
      <button
        type="button"
        onClick={() => (setEditando(true), setMenu(false))}
        className={botao}
      >
        <Pencil size={15} aria-hidden="true" /> Editar
      </button>
      <button
        type="button"
        disabled={enviando}
        onClick={() => executar(() => arquivarTag(tag.id, !tag.arquivada))}
        className={botao}
      >
        {tag.arquivada ? (
          <ArchiveRestore size={15} aria-hidden="true" />
        ) : (
          <Archive size={15} aria-hidden="true" />
        )}
        {tag.arquivada ? "Desarquivar" : "Arquivar"}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className={`${botao} text-alerta`}
      >
        <Trash2 size={15} aria-hidden="true" /> Apagar
      </button>
    </>
  );

  return (
    <span className="relative inline-flex">
      {compacto ? (
        <button
          type="button"
          aria-label={`Ações da tag ${tag.nome}`}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
          className="hover:bg-superficie/60 grid size-8 place-items-center rounded-lg"
        >
          <Ellipsis size={18} aria-hidden="true" />
        </button>
      ) : (
        <span className="flex flex-wrap gap-2">{acoes}</span>
      )}
      {compacto && menu && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMenu(false)}
            className="fixed inset-0 z-30"
          />
          <span className="bg-superficie border-borda absolute top-full right-0 z-40 mt-1 flex w-max flex-col gap-1.5 rounded-xl border p-2 shadow-lg">
            {acoes}
          </span>
        </>
      )}
      {confirmando && (
        <Janela
          titulo={`Apagar a tag ${tag.nome}?`}
          fechar={() => setConfirmando(false)}
        >
          <p className="text-tinta-2 text-[13.5px]">
            Os movimentos ficam como estão, só perdem a tag. Não dá para
            desfazer.
          </p>
          {erro && (
            <p
              role="alert"
              className="bg-alerta-fundo text-alerta rounded-[9px] px-3 py-2 text-[13px]"
            >
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="border-borda text-tinta-2 hover:bg-superficie-2 rounded-[10px] border px-3.5 py-2 text-[13px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() =>
                executar(
                  () => apagarTag(tag.id),
                  () => depoisDeApagar && router.push(depoisDeApagar),
                )
              }
              className="bg-alerta-forte text-sobre-cor rounded-[10px] px-3.5 py-2 text-[13px] font-bold hover:opacity-90 disabled:opacity-60"
            >
              Apagar tag
            </button>
          </div>
        </Janela>
      )}
      {erro && !confirmando && (
        <span
          role="alert"
          className="text-alerta absolute top-full right-0 mt-1 text-[12.5px] whitespace-nowrap"
        >
          {erro}
        </span>
      )}
      {editando && (
        <FormularioDeTag tag={tag} fechar={() => setEditando(false)} />
      )}
    </span>
  );
}
