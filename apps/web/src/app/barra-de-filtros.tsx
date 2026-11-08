"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { useState, type ReactNode } from "react";
import { type ContaIdentificavel, SeloDoBanco, nomeDaConta } from "./banco";
import { CalendarioDeIntervalo } from "./calendario";
import { type FiltroDaBarra, type Periodo, enderecoDoFiltro } from "./filtro-da-barra";
import { useLadoDoBalao } from "./lado-do-balao";
import { BolaDaCategoria } from "./movimentos/icones";

export type OpcoesDaBarra = {
  ciclos: { periodo: Periodo; rotulo: string; datas: string }[];
  contas: (ContaIdentificavel & { id: string; tipo: "BANK" | "CREDIT"; final: string | null })[];
  categorias: { id: string; nome: string; icone: string; cor: number }[];
  tags: { id: number; nome: string; icone: string; cor: number }[];
};

const BALAO =
  "bg-superficie border-borda text-tinta z-50 flex max-h-[min(460px,var(--radix-popover-content-available-height))] w-[320px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border p-2 shadow-xl";
export const OPCAO =
  "hover:bg-superficie-2 flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px]";

export function Chip({
  rotulo,
  ativo,
  largura = 320,
  height = 460,
  children,
}: {
  rotulo: string;
  ativo: boolean;
  largura?: number;
  height?: number;
  children: ReactNode;
}) {
  const {
    gatilho: gatilhoBalao,
    lado: ladoBalao,
    deslocamento: deslocamentoBalao,
    alturaMaxima: alturaMaximaBalao,
    decidir: decidirBalao,
  } = useLadoDoBalao(height, largura);
  return (
    <Popover.Root onOpenChange={(abrir) => abrir && decidirBalao()}>
      <Popover.Trigger asChild>
        <button
          ref={gatilhoBalao}
          type="button"
          className={`inline-flex h-[34px] max-w-full items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors ${
            ativo
              ? "bg-marca-clara text-marca border-transparent"
              : "border-borda bg-superficie text-tinta hover:bg-superficie-2"
          }`}
        >
          <span className="truncate">{rotulo}</span>
          <ChevronDown size={14} aria-hidden="true" className="shrink-0 opacity-60" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          alignOffset={deslocamentoBalao}
          side={ladoBalao}
          style={{ maxHeight: alturaMaximaBalao, width: largura }}
          avoidCollisions={false}
          sideOffset={6}
          aria-label={rotulo}
          className={BALAO}
        >
          <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
            {children}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Abas dentro do balão, para separar tipos de escolha (ciclos, meses, datas). */
function Abas<T extends string>({ abas, ativa, mudar }: { abas: [T, string][]; ativa: T; mudar: (aba: T) => void }) {
  return (
    <div role="tablist" className="bg-borda-sutil m-1 mb-2 flex gap-0.5 rounded-[10px] p-[3px]">
      {abas.map(([chave, rotulo]) => (
        <button
          key={chave}
          type="button"
          role="tab"
          aria-selected={ativa === chave}
          onClick={() => mudar(chave)}
          className={`flex-1 rounded-lg py-1.5 text-[12.5px] font-semibold ${
            ativa === chave ? "bg-superficie text-marca shadow-sm" : "text-tinta-2 hover:text-tinta"
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

function resumo(escolhidos: string[], nomes: Map<string, string>, todos: string): string {
  if (escolhidos.length === 0) return todos;
  const primeiros = escolhidos.slice(0, 2).map((id) => nomes.get(id) ?? id);
  return escolhidos.length > 2 ? `${primeiros.join(", ")} +${escolhidos.length - 2}` : primeiros.join(", ");
}

const TIPO = { CREDIT: "Cartão de crédito", BANK: "Conta corrente" } as const;

/**
 * Período, conta, categoria e tag, sempre à vista. Cada mudança troca o
 * endereço da página sem levar a tela ao topo, e o servidor refaz os números
 * com o filtro novo.
 */
export function BarraDeFiltros({
  caminho,
  filtro,
  rotuloDoPeriodo,
  opcoes,
  hoje,
}: {
  caminho: string;
  filtro: FiltroDaBarra;
  rotuloDoPeriodo: string;
  opcoes: OpcoesDaBarra;
  hoje: string;
}) {
  const router = useRouter();
  const activePeriodTab = filtro.periodo === "datas" ? "datas" : filtro.periodo === "mes" || filtro.periodo === "mes-anterior" ? "meses" : "ciclos";
  const [abaDoPeriodo, setAbaDoPeriodo] = useState<"ciclos" | "meses" | "datas">(activePeriodTab);
  const [modoDaTag, setModoDaTag] = useState<"so" | "sem">(filtro.semTag ? "sem" : "so");
  const [busca, setBusca] = useState("");
  const filterAddress = enderecoDoFiltro(caminho, filtro);
  const [draftAddress, setDraftAddress] = useState(filterAddress);
  // Voltar e Avançar também mudam a fonte dos rascunhos, preservando o balão aberto.
  if (draftAddress !== filterAddress) {
    setDraftAddress(filterAddress);
    setAbaDoPeriodo(activePeriodTab);
    setModoDaTag(filtro.semTag ? "sem" : "so");
  }
  const ir = (novo: Partial<FiltroDaBarra>) =>
    router.push(enderecoDoFiltro(caminho, { ...filtro, ...novo }), { scroll: false });
  const alternar = (lista: string[], id: string) =>
    lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id];

  const nomeDaOpcao = (conta: OpcoesDaBarra["contas"][number]) => `${nomeDaConta(conta)} ${TIPO[conta.tipo]}`;
  const nomesDasContas = new Map(opcoes.contas.map((conta) => [conta.id, nomeDaOpcao(conta)]));
  const nomesDasCategorias = new Map(opcoes.categorias.map((categoria) => [categoria.id, categoria.nome]));
  const bancos = [...new Set(opcoes.contas.map((conta) => nomeDaConta(conta)))].map((banco) => ({
    banco,
    contas: opcoes.contas.filter((conta) => nomeDaConta(conta) === banco),
  }));
  const tagEscolhida = opcoes.tags.find((tag) => tag.id === (filtro.comTag ?? filtro.semTag));
  const rotuloDaTag = filtro.comTag
    ? `Só ${tagEscolhida?.nome ?? "tag"}`
    : filtro.semTag
      ? `Sem ${tagEscolhida?.nome ?? "tag"}`
      : "Sem filtro de tag";
  const ligados =
    (filtro.periodo !== "atual" ? 1 : 0) +
    filtro.contas.length +
    filtro.categorias.length +
    (filtro.comTag || filtro.semTag ? 1 : 0);
  const categoriasVisiveis = opcoes.categorias.filter((categoria) =>
    categoria.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  return (
    <div role="group" aria-label="Filtros" className="flex flex-wrap items-center gap-2">
      <span className="text-tinta-3 mr-0.5 text-xs font-semibold">Filtrar</span>

      <Chip rotulo={rotuloDoPeriodo} ativo largura={300} height={560}>
        <Abas
          abas={[
            ["ciclos", "Ciclos"],
            ["meses", "Meses"],
            ["datas", "Datas"],
          ]}
          ativa={abaDoPeriodo}
          mudar={setAbaDoPeriodo}
        />
        {abaDoPeriodo === "ciclos" &&
          opcoes.ciclos.map(({ periodo, rotulo, datas }) => (
            <button
              key={periodo}
              type="button"
              className={`${OPCAO} ${filtro.periodo === periodo ? "bg-marca-clara text-marca font-bold" : ""}`}
              onClick={() => ir({ periodo, de: undefined, ate: undefined })}
            >
              {rotulo}{" "}
              <span className="text-tinta-3 num ml-auto text-[12px] font-normal">{datas}</span>
            </button>
          ))}
        {abaDoPeriodo === "meses" &&
          (["mes", "mes-anterior"] as const).map((periodo) => (
            <button
              key={periodo}
              type="button"
              className={`${OPCAO} ${filtro.periodo === periodo ? "bg-marca-clara text-marca font-bold" : ""}`}
              onClick={() => ir({ periodo, de: undefined, ate: undefined })}
            >
              {periodo === "mes" ? "Este mês" : "Mês passado"}
            </button>
          ))}
        {abaDoPeriodo === "datas" && (
          <div className="px-1.5 pb-1">
            <CalendarioDeIntervalo
              key={`${filtro.de ?? ""}/${filtro.ate ?? ""}`}
              de={filtro.de}
              ate={filtro.ate}
              hoje={hoje}
              aplicar={(de, ate) => ir({ periodo: "datas", de, ate })}
            />
          </div>
        )}
      </Chip>

      <Chip rotulo={resumo(filtro.contas, nomesDasContas, "Todas as contas")} ativo={filtro.contas.length > 0} largura={320}>
        {bancos.map(({ banco, contas }) => (
          <div key={banco} className="border-borda-sutil m-1 flex flex-col gap-2 rounded-[12px] border p-2.5">
            <span className="flex items-center gap-2 text-[13.5px] font-bold">
              <SeloDoBanco conta={contas[0]} tamanho={22} />
              {banco}
            </span>
            <span className="flex flex-wrap gap-1.5">
              {contas.map((conta) => {
                const marcada = filtro.contas.includes(conta.id);
                return (
                  <button
                    key={conta.id}
                    type="button"
                    aria-pressed={marcada}
                    aria-label={nomeDaOpcao(conta)}
                    onClick={() => ir({ contas: alternar(filtro.contas, conta.id) })}
                    className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${
                      marcada ? "bg-marca text-sobre-cor border-transparent" : "border-borda text-tinta-2 hover:bg-superficie-2"
                    }`}
                  >
                    {TIPO[conta.tipo]}
                    {conta.final ? <span className="num ml-1 opacity-70">•{conta.final}</span> : null}
                  </button>
                );
              })}
            </span>
          </div>
        ))}
      </Chip>

      <Chip
        rotulo={resumo(filtro.categorias, nomesDasCategorias, "Todas as categorias")}
        ativo={filtro.categorias.length > 0}
        largura={360}
      >
        <label className="border-borda m-1 flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5">
          <Search size={14} aria-hidden="true" className="text-tinta-3" />
          <input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar categoria"
            aria-label="Buscar categoria"
            className="w-full bg-transparent text-[13px] outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1.5 p-1">
          {categoriasVisiveis.map((categoria) => {
            const marcada = filtro.categorias.includes(categoria.id);
            return (
              <button
                key={categoria.id}
                type="button"
                aria-pressed={marcada}
                onClick={() => ir({ categorias: alternar(filtro.categorias, categoria.id) })}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-[12.5px] font-semibold ${
                  marcada ? "bg-marca text-sobre-cor border-transparent" : "border-borda text-tinta hover:bg-superficie-2"
                }`}
              >
                <BolaDaCategoria categoria={categoria} tamanho={24} />
                {categoria.nome}
              </button>
            );
          })}
        </div>
      </Chip>

      <Chip rotulo={rotuloDaTag} ativo={Boolean(filtro.comTag || filtro.semTag)} largura={300}>
        <Abas
          abas={[
            ["so", "Mostrar só"],
            ["sem", "Esconder"],
          ]}
          ativa={modoDaTag}
          mudar={(modo) => {
            setModoDaTag(modo);
            const atual = filtro.comTag ?? filtro.semTag;
            if (atual) ir(modo === "so" ? { comTag: atual, semTag: undefined } : { semTag: atual, comTag: undefined });
          }}
        />
        {opcoes.tags.length === 0 && <span className="text-tinta-3 px-2.5 py-2 text-[13px]">Nenhuma tag criada.</span>}
        {opcoes.tags.map((tag) => {
          const marcada = (filtro.comTag ?? filtro.semTag) === tag.id;
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={marcada}
              onClick={() => ir(modoDaTag === "so" ? { comTag: tag.id, semTag: undefined } : { semTag: tag.id, comTag: undefined })}
              className={`${OPCAO} ${marcada ? "bg-marca-clara text-marca font-bold" : ""}`}
            >
              <BolaDaCategoria categoria={tag} tamanho={26} />
              <span className="min-w-0 flex-1 truncate">{tag.nome}</span>
            </button>
          );
        })}
        {(filtro.comTag || filtro.semTag) && (
          <>
            <div className="bg-borda-sutil mx-1 my-1 h-px" />
            <button type="button" className={`${OPCAO} text-tinta-2`} onClick={() => ir({ comTag: undefined, semTag: undefined })}>
              Sem filtro de tag
            </button>
          </>
        )}
      </Chip>

      {ligados > 0 && (
        <button
          type="button"
          onClick={() =>
            router.push(
              enderecoDoFiltro(caminho, { periodo: "atual", contas: [], categorias: [], referencia: filtro.referencia }),
              { scroll: false },
            )
          }
          className="bg-alerta-fundo text-alerta inline-flex h-[34px] items-center gap-1.5 rounded-full px-3 text-[13px] font-bold hover:brightness-95"
        >
          <X size={14} aria-hidden="true" /> Limpar filtros
          <span className="bg-alerta text-superficie num rounded-full px-1.5 text-[11px] leading-[18px]">{ligados}</span>
        </button>
      )}
    </div>
  );
}
