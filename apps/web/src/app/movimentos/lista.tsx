"use client";

import { ListChecks, Tag as IconeDeTag, X } from "lucide-react";
import { Popover } from "radix-ui";
import { type PointerEvent, useRef, useState, useTransition } from "react";
import { marcarVarios } from "../acoes";
import { SeloDoBanco, nomeDaConta } from "../banco";
import type { Categoria, Movimento, Tag } from "../buscar-movimentos";
import type { Conta } from "../buscar-resumo";
import { diaEMes, moeda } from "../formato";
import { CategoriaDoMovimento, EscolhaDeCategoria } from "./categoria";
import { BolaDaCategoria } from "./icones";

/** Transferência entre contas do mesmo titular não é entrada nem saída. */
const ENTRADAS = new Set(["receita"]);
const SAIDAS = new Set(["despesa"]);

function corDoValor(tipo: string): string {
  if (ENTRADAS.has(tipo)) return "text-positivo";
  return SAIDAS.has(tipo) ? "text-gasto" : "text-tinta-3";
}

function sinalDoValor(tipo: string): string {
  if (ENTRADAS.has(tipo)) return "+ ";
  return SAIDAS.has(tipo) ? "- " : "";
}

// No celular a linha vira duas: descrição e valor em cima, data, conta e
// categoria embaixo. A coluna de conta some e a conta vai junto da data. A
// caixa de seleção só aparece no celular depois de "Selecionar".
const COLUNAS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 px-4 md:grid-cols-[20px_76px_minmax(0,1fr)_190px_170px_130px] md:px-[22px]";
const COLUNAS_SELECIONANDO = "max-md:grid-cols-[20px_minmax(0,1fr)_auto]";

// Segurar o dedo numa linha por meio segundo entra na seleção, como nos apps
// de celular; menos que isso é toque comum.
const SEGURAR_MS = 500;

export function Lista({
  movimentos,
  contas,
  categorias = null,
  tagsExistentes = [],
  tags = [],
  vazio = "Nenhum movimento neste recorte.",
}: {
  movimentos: Movimento[];
  contas: Conta[];
  categorias?: Categoria[] | null;
  tagsExistentes?: string[];
  /** As tags com ícone e cor, para marcar vários de uma vez. */
  tags?: Tag[];
  vazio?: string;
}) {
  const porId = new Map(contas.map((conta) => [conta.id, conta]));
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const segurando = useRef<ReturnType<typeof setTimeout> | null>(null);

  function alternar(id: number) {
    setSelecionados((atuais) => {
      const novos = new Set(atuais);
      if (novos.has(id)) {
        novos.delete(id);
      } else {
        novos.add(id);
      }
      return novos;
    });
  }

  function cancelar() {
    setSelecionados(new Set());
    setSelecionando(false);
  }

  function comecarASegurar(evento: PointerEvent, id: number) {
    if (evento.pointerType !== "touch" || selecionando) return;
    segurando.current = setTimeout(() => {
      setSelecionando(true);
      setSelecionados(new Set([id]));
    }, SEGURAR_MS);
  }

  function soltar() {
    if (segurando.current) clearTimeout(segurando.current);
    segurando.current = null;
  }

  const todosMarcados =
    movimentos.length > 0 && movimentos.every((m) => selecionados.has(m.id));

  return (
    <section
      aria-label="Movimentos"
      className="bg-superficie border-borda flex flex-col rounded-2xl border"
    >
      {movimentos.length > 0 && (
        <div className="flex justify-end px-4 pt-3 md:hidden">
          <button
            type="button"
            onClick={() => (selecionando ? cancelar() : setSelecionando(true))}
            className="text-marca inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13px] font-bold hover:bg-marca-clara"
          >
            {selecionando ? (
              "Cancelar"
            ) : (
              <>
                <ListChecks size={16} aria-hidden="true" /> Selecionar
              </>
            )}
          </button>
        </div>
      )}

      {selecionados.size > 0 && (
        <BarraDeAcao
          ids={[...selecionados]}
          categorias={categorias}
          tags={tags}
          concluir={cancelar}
        />
      )}

      <div
        className={`${COLUNAS} bg-superficie-2 border-borda items-center border-b py-3 max-md:hidden ${selecionados.size > 0 ? "" : "rounded-t-2xl"}`}
      >
        <input
          type="checkbox"
          aria-label="Selecionar todos"
          checked={todosMarcados}
          onChange={() =>
            setSelecionados(
              todosMarcados ? new Set() : new Set(movimentos.map((m) => m.id)),
            )
          }
          className="accent-marca h-4 w-4"
        />
        {["Data", "Descrição", "Categoria", "Conta", "Valor"].map((titulo) => (
          <span
            key={titulo}
            className={`text-tinta-3 text-[13px] font-semibold tracking-[0.04em] uppercase ${titulo === "Valor" ? "text-right" : ""}`}
          >
            {titulo}
          </span>
        ))}
      </div>

      {movimentos.length === 0 ? (
        <p className="text-tinta-3 px-[22px] py-8 text-center text-[13px]">
          {vazio}
        </p>
      ) : (
        movimentos.map((movimento) => {
          const conta = porId.get(movimento.contaId);
          const nomeConta = conta
            ? `${conta.tipo === "CREDIT" ? "Cartão" : "Conta"} ${nomeDaConta(conta)}`
            : movimento.contaId;
          const marcado = selecionados.has(movimento.id);
          // No celular, com a caixa à vista, cada parte anda uma coluna.
          const deslocar = selecionando
            ? "max-md:col-start-2"
            : "max-md:col-start-1";
          const deslocarDireita = selecionando
            ? "max-md:col-start-3"
            : "max-md:col-start-2";
          return (
            <div
              key={movimento.id}
              onPointerDown={(evento) => comecarASegurar(evento, movimento.id)}
              onPointerUp={soltar}
              onPointerLeave={soltar}
              onPointerMove={soltar}
              className={`${COLUNAS} ${selecionando ? COLUNAS_SELECIONANDO : ""} border-borda-sutil items-center border-b py-3 last:border-b-0 ${marcado ? "bg-marca-clara/50" : ""}`}
            >
              <input
                type="checkbox"
                aria-label={`Selecionar ${movimento.descricao}`}
                checked={marcado}
                onChange={() => alternar(movimento.id)}
                className={`accent-marca h-4 w-4 max-md:row-span-2 ${selecionando ? "" : "max-md:hidden"}`}
              />

              <span
                className={`num text-tinta-2 min-w-0 truncate text-[13px] max-md:row-start-2 ${deslocar}`}
              >
                {diaEMes(movimento.data)}
                <span className="md:hidden"> · {nomeConta}</span>
              </span>

              <span
                className={`flex min-w-0 flex-col max-md:row-start-1 ${deslocar}`}
              >
                <span className="truncate text-[13.5px]">
                  {movimento.descricao}
                </span>
                {movimento.tags.length > 0 && (
                  <span className="flex flex-wrap gap-1 pt-0.5">
                    {movimento.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-marca-clara text-marca inline-flex items-center gap-1 rounded-full px-1.5 text-[11.5px] font-semibold"
                      >
                        <IconeDeTag size={11} aria-hidden="true" /> {tag}
                      </span>
                    ))}
                  </span>
                )}
                {movimento.pagamentoDeFatura !== null &&
                  movimento.pagamentoDeFatura !== "descartado" && (
                    <span className="text-tinta-3 text-[13px]">
                      pagamento de fatura, fora das somas de gasto
                    </span>
                  )}
                {movimento.duplicadoPossivel && (
                  <span className="text-gasto text-[13px]">
                    possível duplicidade, valor incluído no total
                  </span>
                )}
              </span>

              <span
                className={`flex min-w-0 max-md:row-start-2 max-md:justify-self-end ${deslocarDireita}`}
              >
                <CategoriaDoMovimento
                  movimento={movimento}
                  categorias={categorias}
                  tagsExistentes={tagsExistentes}
                />
              </span>

              <span className="flex min-w-0 items-center gap-2 max-md:hidden">
                {conta && <SeloDoBanco conta={conta} tamanho={22} />}
                <span className="text-tinta-2 truncate text-[12.5px]">
                  {nomeConta}
                </span>
              </span>

              <span
                className={`num text-right text-[13.5px] font-semibold max-md:row-start-1 ${deslocarDireita} ${corDoValor(movimento.tipo)}`}
              >
                {sinalDoValor(movimento.tipo)}
                {moeda(movimento.valor)}
              </span>
            </div>
          );
        })
      )}
    </section>
  );
}

// O balão de marcar vários: cabe no espaço que sobra na tela, para cima ou
// para baixo, e rola por dentro.
const BALAO =
  "bg-superficie border-borda text-tinta z-50 flex max-h-[min(460px,var(--radix-popover-content-available-height))] w-[340px] max-w-[calc(100vw-24px)] flex-col gap-3 rounded-2xl border p-4 shadow-xl";

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** As tags com ícone e cor, como a lista de categorias; a busca que não acha
 *  nada oferece criar a tag com esse nome. */
function EscolhaDeTag({
  tags,
  busca,
  buscar,
  escolhida,
  escolher,
}: {
  tags: Tag[];
  busca: string;
  buscar: (texto: string) => void;
  escolhida: string;
  escolher: (nome: string) => void;
}) {
  const filtro = semAcento(busca);
  const ativas = tags.filter(
    (tag) => !tag.arquivada && semAcento(tag.nome).includes(filtro),
  );
  const existe = tags.some((tag) => semAcento(tag.nome) === filtro);
  return (
    <>
      <label className="border-borda text-tinta-3 focus-within:border-marca flex items-center gap-2 rounded-[10px] border px-2.5 py-2">
        <IconeDeTag size={16} aria-hidden="true" />
        <input
          value={busca}
          onChange={(evento) => buscar(evento.target.value)}
          placeholder="Buscar ou criar tag"
          aria-label="Buscar ou criar tag"
          maxLength={60}
          className="text-tinta min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
        />
      </label>
      <div
        role="radiogroup"
        aria-label="Tag"
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1"
      >
        {ativas.map((tag) => (
          <label
            key={tag.id}
            className="has-checked:bg-marca-clara has-checked:text-marca hover:bg-superficie-2 has-focus-visible:outline-marca flex shrink-0 cursor-pointer items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-[13.5px] has-checked:font-bold has-focus-visible:outline-2"
          >
            <input
              type="radio"
              name="tag"
              checked={escolhida === tag.nome}
              onChange={() => escolher(tag.nome)}
              className="sr-only"
            />
            <BolaDaCategoria categoria={tag} />
            <span className="flex-1 truncate">{tag.nome}</span>
          </label>
        ))}
        {filtro && !existe && (
          <button
            type="button"
            onClick={() => escolher(busca.trim())}
            aria-pressed={escolhida === busca.trim()}
            className="border-marca text-marca hover:bg-marca-clara aria-pressed:bg-marca-clara mt-1 flex shrink-0 items-center justify-center gap-2 rounded-[9px] border border-dashed px-2 py-2 text-[13px] font-bold"
          >
            Criar &quot;{busca.trim()}&quot;
          </button>
        )}
        {ativas.length === 0 && !filtro && (
          <p className="text-tinta-3 px-1 text-[13px]">
            Nenhuma tag ainda. Digite um nome para criar.
          </p>
        )}
      </div>
    </>
  );
}

/** Com algo marcado: tag ou categoria para todos. No computador fica no topo
 *  da lista; no celular flutua sobre a navegação de baixo. */
function BarraDeAcao({
  ids,
  categorias,
  tags,
  concluir,
}: {
  ids: number[];
  categorias: Categoria[] | null;
  tags: Tag[];
  concluir: () => void;
}) {
  const [aberto, setAberto] = useState<"tag" | "categoria" | null>(null);
  const [valor, setValor] = useState("");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function aplicar() {
    const marca =
      aberto === "tag" ? { tag: valor.trim() } : { categoria: valor };
    iniciar(async () => {
      const resultado = await marcarVarios(ids, marca);
      setErro(resultado.erro);
      if (!resultado.erro) {
        concluir();
      }
    });
  }

  const botao =
    "inline-flex items-center gap-1.5 rounded-lg bg-sobre-cor/20 px-2.5 py-1.5 text-[13px] font-semibold transition-colors hover:bg-sobre-cor/35";

  return (
    <div
      role="region"
      aria-label="Ações nos selecionados"
      className="bg-marca text-sobre-cor relative z-30 flex flex-col gap-2 px-4 py-2.5 md:rounded-t-2xl max-md:fixed max-md:inset-x-3 max-md:bottom-[76px] max-md:rounded-2xl max-md:shadow-xl"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-[13px] font-semibold">
          {ids.length === 1 ? "1 selecionado" : `${ids.length} selecionados`}
        </span>
        <Popover.Root
          open={aberto === "tag"}
          onOpenChange={(abrir) => {
            setValor("");
            setBusca("");
            setAberto(abrir ? "tag" : null);
          }}
        >
          <Popover.Trigger asChild>
            <button type="button" aria-label="Marcar com tag" className={botao}>
              <IconeDeTag size={14} aria-hidden="true" />
              <span className="md:hidden">Tag</span>
              <span className="max-md:hidden">Marcar com tag</span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={8}
              collisionPadding={12}
              aria-label={`Tag para ${ids.length === 1 ? "1 movimento" : `${ids.length} movimentos`}`}
              className={BALAO}
            >
              <form
                onSubmit={(evento) => {
                  evento.preventDefault();
                  aplicar();
                }}
                className="flex min-h-0 flex-1 flex-col gap-3"
              >
                <strong className="text-[14px]">
                  Tag para{" "}
                  {ids.length === 1
                    ? "1 movimento"
                    : `${ids.length} movimentos`}
                </strong>
                <EscolhaDeTag
                  tags={tags}
                  busca={busca}
                  buscar={setBusca}
                  escolhida={valor}
                  escolher={setValor}
                />
                {erro && (
                  <p
                    role="alert"
                    className="bg-alerta-fundo text-alerta rounded-lg px-3 py-2 text-[13px]"
                  >
                    {erro}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={enviando || !valor.trim()}
                  className="bg-marca text-sobre-cor hover:bg-marca-escura self-end rounded-[10px] px-3.5 py-2 text-[13px] font-bold disabled:opacity-60"
                >
                  {enviando ? "Aplicando" : "Aplicar"}
                </button>
              </form>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {categorias && (
          <Popover.Root
            open={aberto === "categoria"}
            onOpenChange={(abrir) => {
              setValor("");
              setBusca("");
              setAberto(abrir ? "categoria" : null);
            }}
          >
            <Popover.Trigger asChild>
              <button type="button" className={botao}>
                Categoria
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={8}
                collisionPadding={12}
                aria-label={`Categoria para ${ids.length === 1 ? "1 movimento" : `${ids.length} movimentos`}`}
                // Cabe no espaço que sobra na tela, para cima ou para baixo.
                className={BALAO}
              >
                <form
                  onSubmit={(evento) => {
                    evento.preventDefault();
                    aplicar();
                  }}
                  className="flex min-h-0 flex-1 flex-col gap-3"
                >
                  <strong className="text-[14px]">
                    Categoria para{" "}
                    {ids.length === 1
                      ? "1 movimento"
                      : `${ids.length} movimentos`}
                  </strong>
                  <EscolhaDeCategoria
                    categorias={categorias}
                    busca={busca}
                    buscar={setBusca}
                    escolhida={valor}
                    escolher={setValor}
                  />
                  <p className="text-tinta-3 text-[12.5px]">
                    Vale só para os selecionados, sem virar regra.
                  </p>
                  {erro && (
                    <p
                      role="alert"
                      className="bg-alerta-fundo text-alerta rounded-lg px-3 py-2 text-[13px]"
                    >
                      {erro}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={enviando || !valor}
                    className="bg-marca text-sobre-cor hover:bg-marca-escura self-end rounded-[10px] px-3.5 py-2 text-[13px] font-bold disabled:opacity-60"
                  >
                    {enviando ? "Aplicando" : "Aplicar"}
                  </button>
                </form>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
        <button
          type="button"
          onClick={concluir}
          aria-label="Limpar seleção"
          className={botao}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {erro && aberto === null && (
        <p
          role="alert"
          className="bg-alerta-fundo text-alerta rounded-lg px-3 py-2 text-[13px]"
        >
          {erro}
        </p>
      )}
    </div>
  );
}
