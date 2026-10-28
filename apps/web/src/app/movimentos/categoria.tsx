"use client";

import { ArrowLeft, Plus, Search, Tag as IconeDeTag, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { classificarMovimento, criarCategoria, definirTags } from "../acoes";
import { type Categoria, type Movimento, levaCategoria } from "../buscar-movimentos";
import { partesDaDescricao } from "../recorrencias/cartao";
import { BolaDaCategoria, CORES_PARA_CRIAR, ICONES_PARA_CRIAR, IconeDaCategoria } from "./icones";

// Altura máxima do balão no computador, a mesma do `md:max-h` do painel.
const ALTURA_DO_PAINEL = 560;

const semAcento = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * A categoria e as tags do movimento, que abrem a escolha ao tocar. No
 * computador a escolha aparece como balão sob a categoria; no celular, como
 * folha que sobe de baixo. Só a lista rola: busca, tags e "vale para" ficam
 * sempre à vista.
 */
export function CategoriaDoMovimento({
  movimento,
  categorias,
  tagsExistentes = [],
}: {
  movimento: Movimento;
  categorias: Categoria[] | null;
  tagsExistentes?: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const [paraCima, setParaCima] = useState(false);

  if (!levaCategoria(movimento)) {
    return null;
  }

  const { nome } = partesDaDescricao(movimento.descricao);
  const atual = categorias?.find((categoria) => categoria.id === movimento.categoriaPropria);
  const rotulo = atual?.nome ?? (movimento.categoriaPropria ? movimento.categoriaPropria : "Para classificar");

  return (
    <span className="relative inline-flex min-w-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Categoria de ${nome}: ${rotulo}. Alterar`}
        disabled={categorias === null}
        onClick={(evento) => {
          // Sem espaço embaixo, o balão abre para cima: aberto para baixo no
          // fim da lista, ele esticava a página além da tela.
          const caixa = evento.currentTarget.getBoundingClientRect();
          const embaixo = window.innerHeight - caixa.bottom;
          setParaCima(embaixo < ALTURA_DO_PAINEL && caixa.top > embaixo);
          setAberto(!aberto);
        }}
        className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full border text-[12.5px] font-semibold whitespace-nowrap ${
          atual
            ? "border-borda bg-superficie-2 text-tinta-2 py-0.5 pr-2.5 pl-0.5"
            : "border-aviso-borda bg-aviso-fundo text-aviso px-2.5 py-1"
        } ${aberto ? "border-marca" : ""}`}
      >
        {atual && <BolaDaCategoria categoria={atual} tamanho={22} />}
        <span className="truncate">{rotulo}</span>
      </button>

      {aberto && categorias && (
        <Painel
          movimento={movimento}
          nome={nome}
          categorias={categorias}
          tagsExistentes={tagsExistentes}
          paraCima={paraCima}
          fechar={() => setAberto(false)}
        />
      )}
    </span>
  );
}

function Painel({
  movimento,
  nome,
  categorias,
  tagsExistentes,
  paraCima,
  fechar,
}: {
  movimento: Movimento;
  nome: string;
  categorias: Categoria[];
  tagsExistentes: string[];
  paraCima: boolean;
  fechar: () => void;
}) {
  const [escolhida, setEscolhida] = useState(movimento.categoriaPropria ?? "");
  // Começa sempre em "só este": virar regra para o destinatário é escolha
  // explícita, porque muda os próximos movimentos dele sem aviso.
  const [alcance, setAlcance] = useState<"todos" | "este">("este");
  const [busca, setBusca] = useState("");
  const [tags, setTags] = useState(movimento.tags);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    painel.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [criando]);

  const usadas = movimento.historico.flatMap(({ categoria, vezes }) => {
    const encontrada = categorias.find((item) => item.id === categoria);
    return encontrada ? [{ categoria: encontrada, vezes }] : [];
  });

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData();
    dados.set("movimento_id", String(movimento.id));
    dados.set("categoria", escolhida);
    dados.set("alcance", alcance);
    const mudouCategoria = escolhida !== (movimento.categoriaPropria ?? "");
    const mudouTags = tags.join("\u0000") !== movimento.tags.join("\u0000");
    iniciar(async () => {
      const resultados = [
        mudouCategoria ? await classificarMovimento(dados) : { erro: null },
        mudouTags ? await definirTags(movimento.id, tags) : { erro: null },
      ];
      const falha = resultados.find((resultado) => resultado.erro)?.erro ?? null;
      setErro(falha);
      if (!falha) {
        fechar();
      }
    });
  }

  return (
    <>
      <div aria-hidden="true" onClick={fechar} className="bg-tinta/30 fixed inset-0 z-40 md:bg-transparent" />
      <div
        ref={painel}
        role="dialog"
        aria-label={`Categoria de ${nome}`}
        onKeyDown={(evento) => evento.key === "Escape" && fechar()}
        className={`bg-superficie border-borda fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col gap-3 rounded-t-2xl border p-4 shadow-xl md:absolute md:inset-x-auto md:right-0 md:max-h-[560px] md:w-[380px] md:rounded-2xl ${
          paraCima ? "md:bottom-full md:mb-2" : "md:top-full md:bottom-auto md:mt-2"
        }`}
      >
        <span aria-hidden="true" className="bg-borda h-1 w-10 shrink-0 self-center rounded-full md:hidden" />
        {criando ? (
          <NovaCategoria
            nomeInicial={busca}
            voltar={() => setCriando(false)}
            criada={(id) => {
              setEscolhida(id);
              setBusca("");
              setCriando(false);
            }}
          />
        ) : (
          <form onSubmit={salvar} className="flex min-h-0 flex-1 flex-col gap-3">
            <strong className="text-[14px]">Categoria de {nome}</strong>
            <EscolhaDeCategoria
              categorias={categorias}
              usadas={usadas}
              para={nome}
              busca={busca}
              buscar={setBusca}
              escolhida={escolhida}
              escolher={setEscolhida}
              criar={() => setCriando(true)}
            />

            <CampoDeTags tags={tags} mudar={setTags} existentes={tagsExistentes} />

            {erro && (
              <p role="alert" className="bg-alerta-fundo text-alerta rounded-[9px] px-3 py-2 text-[13px]">
                {erro}
              </p>
            )}

            <div className="border-borda-sutil flex items-end gap-2 border-t pt-3">
              <fieldset className="flex min-w-0 flex-1 flex-col gap-1">
                <legend className="text-tinta-3 mb-1 text-[12px]">Vale para</legend>
                <div className="border-borda grid grid-cols-[1.4fr_1fr] rounded-[10px] border p-[3px] text-[12.5px]">
                  {(
                    [
                      ["todos", `Todos de ${nome}`],
                      ["este", "Só este"],
                    ] as const
                  ).map(([valor, texto]) => (
                    <label
                      key={valor}
                      className="text-tinta-2 has-checked:bg-marca has-checked:text-sobre-cor has-focus-visible:outline-marca cursor-pointer truncate rounded-lg px-1.5 py-1.5 text-center has-checked:font-bold has-focus-visible:outline-2"
                    >
                      <input
                        type="radio"
                        name="alcance"
                        value={valor}
                        checked={alcance === valor}
                        onChange={() => setAlcance(valor)}
                        className="sr-only"
                      />
                      {texto}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="submit"
                disabled={enviando || !escolhida}
                className="bg-marca text-sobre-cor rounded-[10px] px-3.5 py-2.5 text-[13px] font-bold disabled:opacity-60"
              >
                {enviando ? "Salvando" : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

/**
 * Busca e lista de categorias com ícone, a mesma na escolha de um movimento e
 * na de vários. Sem `criar`, não oferece categoria nova.
 */
export function EscolhaDeCategoria({
  categorias,
  usadas = [],
  para,
  busca,
  buscar,
  escolhida,
  escolher,
  criar,
}: {
  categorias: Categoria[];
  usadas?: { categoria: Categoria; vezes: number }[];
  para?: string;
  busca: string;
  buscar: (texto: string) => void;
  escolhida: string;
  escolher: (id: string) => void;
  criar?: () => void;
}) {
  const filtro = semAcento(busca);
  const visiveis = categorias.filter((categoria) => semAcento(categoria.nome).includes(filtro));
  const outras = filtro ? visiveis : visiveis.filter((categoria) => !usadas.some((u) => u.categoria.id === categoria.id));

  return (
    <>
      <label className="border-borda text-tinta-3 focus-within:border-marca flex items-center gap-2 rounded-[10px] border px-2.5 py-2">
        <Search size={16} aria-hidden="true" />
        <input
          value={busca}
          onChange={(evento) => buscar(evento.target.value)}
          placeholder="Buscar categoria"
          aria-label="Buscar categoria"
          className="text-tinta min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
        />
      </label>

      {/* Um div, não fieldset: fieldset não respeita a altura do flex e a
          lista passaria por cima do que vem embaixo em vez de rolar. */}
      <div role="radiogroup" aria-label="Categoria" className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {!filtro && usadas.length > 0 && (
          <>
            <Secao>Já usadas para {para}</Secao>
            {usadas.map(({ categoria, vezes }) => (
              <Opcao
                key={categoria.id}
                categoria={categoria}
                marcada={escolhida === categoria.id}
                escolher={escolher}
                detalhe={vezes === 1 ? "1 vez" : `${vezes} vezes`}
              />
            ))}
            <Secao>Todas</Secao>
          </>
        )}
        {outras.map((categoria) => (
          <Opcao key={categoria.id} categoria={categoria} marcada={escolhida === categoria.id} escolher={escolher} />
        ))}
        {criar && (
          <button
            type="button"
            onClick={criar}
            className="border-marca text-marca mt-1 flex shrink-0 items-center justify-center gap-2 rounded-[9px] border border-dashed px-2 py-2 text-[13px] font-bold"
          >
            <Plus size={16} aria-hidden="true" />
            {filtro && visiveis.length === 0 ? `Criar "${busca.trim()}"` : "Nova categoria"}
          </button>
        )}
      </div>
    </>
  );
}

function Secao({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-tinta-3 px-1 pt-1.5 pb-0.5 text-[11.5px] font-bold tracking-[0.04em] uppercase">
      {children}
    </span>
  );
}

function Opcao({
  categoria,
  marcada,
  escolher,
  detalhe,
}: {
  categoria: Categoria;
  marcada: boolean;
  escolher: (id: string) => void;
  detalhe?: string;
}) {
  return (
    <label className="has-checked:bg-marca-clara has-checked:text-marca hover:bg-superficie-2 has-focus-visible:outline-marca flex shrink-0 cursor-pointer items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-[13.5px] has-checked:font-bold has-focus-visible:outline-2">
      <input
        type="radio"
        name="categoria"
        value={categoria.id}
        checked={marcada}
        onChange={() => escolher(categoria.id)}
        className="sr-only"
      />
      <BolaDaCategoria categoria={categoria} />
      <span className="flex-1">{categoria.nome}</span>
      {detalhe && <span className="text-tinta-3 text-[12px] font-normal">{detalhe}</span>}
    </label>
  );
}

/** Tags do movimento: Enter ou vírgula acrescenta; as existentes aparecem
 *  como sugestão para não nascer "viagem rio" e "Viagem Rio" separadas. */
function CampoDeTags({
  tags,
  mudar,
  existentes,
}: {
  tags: string[];
  mudar: (tags: string[]) => void;
  existentes: string[];
}) {
  const [texto, setTexto] = useState("");
  const procurado = semAcento(texto);
  const ja = new Set(tags.map(semAcento));
  const sugestoes = procurado
    ? existentes.filter((tag) => semAcento(tag).includes(procurado) && !ja.has(semAcento(tag))).slice(0, 4)
    : [];

  function acrescentar(tag: string) {
    const limpa = tag.trim();
    if (limpa && !ja.has(semAcento(limpa))) {
      mudar([...tags, limpa]);
    }
    setTexto("");
  }

  return (
    <div className="border-borda-sutil flex flex-col gap-1.5 border-t pt-3">
      <span className="text-tinta-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold">
        <IconeDeTag size={14} aria-hidden="true" /> Tags
      </span>
      <div className="border-borda focus-within:border-marca flex flex-wrap items-center gap-1.5 rounded-[10px] border p-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="bg-marca-clara text-marca inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-[12.5px] font-semibold"
          >
            {tag}
            <button
              type="button"
              aria-label={`Tirar a tag ${tag}`}
              onClick={() => mudar(tags.filter((outra) => outra !== tag))}
              className="rounded-full p-0.5"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter" || evento.key === ",") {
              evento.preventDefault();
              acrescentar(sugestoes[0] && semAcento(sugestoes[0]) === procurado ? sugestoes[0] : texto);
            }
          }}
          placeholder="adicionar tag"
          aria-label="Adicionar tag"
          maxLength={60}
          className="text-tinta min-w-[110px] flex-1 bg-transparent px-1 py-0.5 text-[13px] outline-none"
        />
      </div>
      {procurado && (
        <div className="border-borda flex flex-col rounded-[10px] border p-1">
          {sugestoes.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => acrescentar(tag)}
              className="hover:bg-superficie-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]"
            >
              <IconeDeTag size={13} aria-hidden="true" /> {tag}
            </button>
          ))}
          {!existentes.some((tag) => semAcento(tag) === procurado) && (
            <button
              type="button"
              onClick={() => acrescentar(texto)}
              className="hover:bg-superficie-2 text-marca flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold"
            >
              <Plus size={13} aria-hidden="true" /> Criar &quot;{texto.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NovaCategoria({
  nomeInicial,
  voltar,
  criada,
}: {
  nomeInicial: string;
  voltar: () => void;
  criada: (id: string) => void;
}) {
  const [nome, setNome] = useState(nomeInicial.trim());
  const [icone, setIcone] = useState(ICONES_PARA_CRIAR[0]);
  const [cor, setCor] = useState(CORES_PARA_CRIAR[1]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    iniciar(async () => {
      const resultado = await criarCategoria({ nome: nome.trim(), icone, cor });
      setErro(resultado.erro);
      if (resultado.id) {
        criada(resultado.id);
      }
    });
  }

  return (
    <form onSubmit={criar} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <span className="flex items-center gap-2">
        <button type="button" onClick={voltar} aria-label="Voltar para a lista" className="rounded-lg p-1">
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <strong className="text-[14px]">Nova categoria</strong>
      </span>
      <span className="border-borda flex items-center gap-3 rounded-xl border border-dashed p-2.5">
        <BolaDaCategoria categoria={{ icone, cor }} tamanho={40} />
        <b className="text-[14px]">{nome.trim() || "Sem nome"}</b>
      </span>
      <label className="flex flex-col gap-1">
        <span className="text-tinta-3 text-[12px]">Nome</span>
        <input
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          required
          maxLength={60}
          className="border-borda focus:border-marca rounded-[10px] border bg-transparent px-2.5 py-2 text-[13.5px] outline-none"
        />
      </label>
      <fieldset className="grid grid-cols-8 gap-1">
        <legend className="text-tinta-3 mb-1 text-[11.5px] font-bold tracking-[0.04em] uppercase">Ícone</legend>
        {ICONES_PARA_CRIAR.map((nomeDoIcone) => (
          <label
            key={nomeDoIcone}
            className="text-tinta-2 has-checked:border-marca has-checked:bg-marca-clara has-checked:text-marca has-focus-visible:outline-marca grid h-9 cursor-pointer place-items-center rounded-[9px] border border-transparent has-focus-visible:outline-2"
          >
            <input
              type="radio"
              name="icone"
              value={nomeDoIcone}
              checked={icone === nomeDoIcone}
              onChange={() => setIcone(nomeDoIcone)}
              aria-label={nomeDoIcone}
              className="sr-only"
            />
            <IconeDaCategoria nome={nomeDoIcone} tamanho={18} />
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="text-tinta-3 mb-1 text-[11.5px] font-bold tracking-[0.04em] uppercase">Cor</legend>
        {CORES_PARA_CRIAR.map((tom) => (
          <label
            key={tom}
            className="has-checked:outline-marca rounded-full outline-offset-2 has-checked:outline-2 has-focus-visible:outline-2"
          >
            <input
              type="radio"
              name="cor"
              value={tom}
              checked={cor === tom}
              onChange={() => setCor(tom)}
              aria-label={`Cor ${tom}`}
              className="sr-only"
            />
            <BolaDaCategoria categoria={{ icone: "", cor: tom }} tamanho={28} />
          </label>
        ))}
      </fieldset>
      {erro && (
        <p role="alert" className="bg-alerta-fundo text-alerta rounded-[9px] px-3 py-2 text-[13px]">
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={voltar} className="border-borda text-tinta-2 rounded-[10px] border px-3.5 py-2 text-[13px]">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={enviando || !nome.trim()}
          className="bg-marca text-sobre-cor rounded-[10px] px-3.5 py-2 text-[13px] font-bold disabled:opacity-60"
        >
          {enviando ? "Criando" : "Criar e usar"}
        </button>
      </div>
    </form>
  );
}
