"use client";

import { type FormEvent, useState, useTransition } from "react";
import { SeloDoBanco, nomeDaConta } from "../banco";
import type { Conta } from "../buscar-resumo";
import { CATEGORIAS, ROTULO_DA_CATEGORIA, type Recorrencia, type StatusRecorrencia } from "../buscar-recorrencias";
import { decidirRecorrencia } from "../acoes";
import { comoData, diaEMes, moeda } from "../formato";

/**
 * A Pluggy descreve como "Transferência enviada|Nome": o que importa para
 * reconhecer a cobrança é o nome, e o tipo vira contexto.
 */
export function partesDaDescricao(descricao: string): { nome: string; tipo: string | null } {
  const [tipo, ...resto] = descricao.split("|");
  const nome = resto.join("|").trim();
  return nome ? { nome, tipo: tipo.trim() } : { nome: descricao, tipo: null };
}

function mesesEntre(de: string, ate: string): number {
  const inicio = comoData(de);
  const fim = comoData(ate);
  return (fim.getFullYear() - inicio.getFullYear()) * 12 + fim.getMonth() - inicio.getMonth();
}

function Identificacao({ recorrencia, conta }: { recorrencia: Recorrencia; conta?: Conta }) {
  const { nome, tipo } = partesDaDescricao(recorrencia.descricao);
  // "no Nubank", "no cartão Nubank": o apelido já diz o que é e entra como está.
  const onde = conta
    ? (conta.apelido ?? `${conta.tipo === "CREDIT" ? "cartão " : ""}${nomeDaConta(conta)}`)
    : recorrencia.contaId;
  const principal = recorrencia.apelido ? nome : tipo;
  return (
    <div className="flex min-w-0 items-center gap-3">
      {conta && <SeloDoBanco conta={conta} tamanho={36} />}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-base font-semibold" title={recorrencia.descricao}>
          {recorrencia.apelido ?? nome}
        </span>
        <span className="text-tinta-2 truncate text-[13px]">
          {principal ? `${principal} ${conta ? "no" : "em"} ${onde}` : onde}
        </span>
      </span>
    </div>
  );
}

/**
 * Envia a decisão e guarda o erro no próprio cartão: decisão não pode
 * falhar calada.
 *
 * `onSubmit` em vez do `action` do formulário de propósito: ao fim de toda
 * ação o React chama `form.reset()`, e o `<select>` volta à primeira opção
 * mesmo controlado. Depois de uma falha, a categoria escolhida sumiria da
 * tela e o reenvio iria sem ela. O botão clicado vai no `FormData` como
 * `submitter`, que é o que diz qual decisão foi tomada.
 */
function useDecisao() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const submitter = (evento.nativeEvent as SubmitEvent).submitter;
    const dados = new FormData(evento.currentTarget, submitter);
    iniciar(async () => {
      setErro((await decidirRecorrencia(dados)).erro);
    });
  }
  return { erro, enviando, enviar };
}

function ErroDaDecisao({ erro }: { erro: string | null }) {
  return erro ? (
    <p role="alert" className="bg-alerta-fundo text-alerta rounded-[9px] px-3 py-2 text-[13px]">
      {erro}
    </p>
  ) : null;
}

const BOTAO =
  "h-10 cursor-pointer rounded-[10px] border px-3.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60";
const NEUTRO = `${BOTAO} border-borda bg-superficie text-tinta-2 hover:bg-superficie-2`;

/** As quatro decisões. Parcelamento abre o campo de parcelas antes de enviar. */
function Decisoes({ enviando, recorrencia }: { enviando: boolean; recorrencia: Recorrencia }) {
  const [parcelando, setParcelando] = useState(false);
  const campo = `parcelas-${recorrencia.id}`;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="status"
          value="aprovada"
          disabled={enviando}
          className={`${BOTAO} bg-positivo border-positivo text-white`}
        >
          Conta fixa
        </button>
        <button
          type="button"
          aria-expanded={parcelando}
          onClick={() => setParcelando((atual) => !atual)}
          className={parcelando ? `${BOTAO} border-marca bg-marca-clara text-marca` : NEUTRO}
        >
          Parcelamento
        </button>
        <button type="submit" name="status" value="encerrada" disabled={enviando} className={NEUTRO}>
          Encerrada
        </button>
        <button type="submit" name="status" value="rejeitada" disabled={enviando} className={NEUTRO}>
          Não é recorrência
        </button>
      </div>
      {parcelando && (
        <div className="bg-superficie-2 border-borda-sutil flex flex-wrap items-center gap-2.5 rounded-xl border p-3 text-sm">
          <label htmlFor={campo}>Parcelas que faltam</label>
          <input
            id={campo}
            name="parcelas"
            type="number"
            min={1}
            max={120}
            required
            defaultValue={1}
            className="border-borda bg-superficie h-10 w-20 rounded-[9px] border px-3 text-[15px]"
          />
          <button
            type="submit"
            name="status"
            value="parcelamento"
            disabled={enviando}
            className={`${BOTAO} bg-positivo border-positivo text-white`}
          >
            Confirmar
          </button>
        </div>
      )}
    </>
  );
}

/** Uma candidata para decidir: quem cobra, quanto, há quanto tempo. */
export function CartaoPendente({ recorrencia, conta }: { recorrencia: Recorrencia; conta?: Conta }) {
  const { erro, enviando, enviar } = useDecisao();

  return (
    <form onSubmit={enviar} className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border p-4">
      <input type="hidden" name="id" value={recorrencia.id} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Identificacao recorrencia={recorrencia} conta={conta} />
        <span className="flex flex-col sm:items-end">
          <span className="num text-gasto text-xl font-bold">{moeda(recorrencia.valorMedio)}</span>
          <span className="text-tinta-2 text-[13px]">
            {recorrencia.ocorrencias} cobranças, de {diaEMes(recorrencia.primeiraData)} a{" "}
            {diaEMes(recorrencia.ultimaData)}
          </span>
        </span>
      </div>
      <Decisoes enviando={enviando} recorrencia={recorrencia} />
      <ErroDaDecisao erro={erro} />
    </form>
  );
}

const ESTADO: Record<Exclude<StatusRecorrencia, "pendente">, { rotulo: string; classe: string }> = {
  aprovada: { rotulo: "Conta fixa", classe: "bg-positivo-fundo text-positivo" },
  parcelamento: { rotulo: "Parcelamento", classe: "bg-marca-clara text-marca" },
  encerrada: { rotulo: "Encerrada", classe: "bg-borda-sutil text-tinta-2" },
  rejeitada: { rotulo: "Não é recorrência", classe: "bg-fixa-fundo text-fixa" },
};

function detalheDaDecidida(recorrencia: Recorrencia): string {
  if (recorrencia.status === "encerrada" || recorrencia.status === "rejeitada") {
    return `última em ${diaEMes(recorrencia.ultimaData)}`;
  }
  return `todo dia ${Number(recorrencia.ultimaData.slice(8, 10))}`;
}

/** Uma já decidida: o estado à vista e o caminho para mudar. */
export function CartaoDecidido({ recorrencia, conta }: { recorrencia: Recorrencia; conta?: Conta }) {
  const { erro, enviando, enviar } = useDecisao();
  const [mudando, setMudando] = useState(false);
  const estado = ESTADO[recorrencia.status as Exclude<StatusRecorrencia, "pendente">];
  const campo = `recorrencia-${recorrencia.id}`;
  const faltam =
    recorrencia.status === "parcelamento" && recorrencia.fimPrevisto
      ? Math.max(mesesEntre(recorrencia.ultimaData, recorrencia.fimPrevisto), 0)
      : null;
  const total = faltam === null ? null : recorrencia.ocorrencias + faltam;

  return (
    <form onSubmit={enviar} className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border p-4">
      <input type="hidden" name="id" value={recorrencia.id} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Identificacao recorrencia={recorrencia} conta={conta} />
        <span className="flex flex-col sm:items-end">
          <span className="num text-tinta text-xl font-bold">{moeda(recorrencia.valorMedio)}</span>
          <span className="text-tinta-2 text-[13px]">{detalheDaDecidida(recorrencia)}</span>
        </span>
      </div>

      {total !== null && recorrencia.fimPrevisto && (
        <div className="flex flex-col gap-1.5">
          <div
            role="meter"
            aria-label={`Parcelas pagas de ${recorrencia.apelido ?? partesDaDescricao(recorrencia.descricao).nome}`}
            aria-valuenow={recorrencia.ocorrencias}
            aria-valuemin={0}
            aria-valuemax={total}
            className="bg-marca-clara h-2.5 overflow-hidden rounded-full"
          >
            <div
              style={{ width: `${(recorrencia.ocorrencias / total) * 100}%` }}
              className="bg-marca h-full rounded-full"
            />
          </div>
          <p className="text-tinta-2 flex justify-between gap-3 text-sm font-semibold">
            <span>
              {recorrencia.ocorrencias} de {total} pagas
            </span>
            <span>
              termina em {recorrencia.fimPrevisto.slice(5, 7)}/{recorrencia.fimPrevisto.slice(0, 4)}
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className={`${estado.classe} rounded-full px-3 py-1 text-[13px] font-bold`}>{estado.rotulo}</span>
        <button
          type="button"
          aria-expanded={mudando}
          onClick={() => setMudando((atual) => !atual)}
          className={`${NEUTRO} text-marca`}
        >
          {mudando ? "Fechar" : "Mudar"}
        </button>
      </div>

      {mudando && (
        <div className="border-borda-sutil flex flex-col gap-3 border-t pt-3.5">
          <div className="flex flex-wrap gap-2.5">
            <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13px]">
              <span className="text-tinta-2 font-semibold">Apelido</span>
              <input
                type="text"
                name="apelido"
                id={`${campo}-apelido`}
                defaultValue={recorrencia.apelido ?? ""}
                maxLength={100}
                className="border-borda bg-superficie h-10 rounded-[9px] border px-3 text-sm"
              />
            </label>
            <label className="flex min-w-[170px] flex-col gap-1 text-[13px]">
              <span className="text-tinta-2 font-semibold">Categoria</span>
              <select
                name="categoria"
                id={`${campo}-categoria`}
                defaultValue={recorrencia.categoria ?? ""}
                className="border-borda bg-superficie h-10 rounded-[9px] border px-3 text-sm"
              >
                <option value="">Sem categoria</option>
                {CATEGORIAS.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {ROTULO_DA_CATEGORIA[opcao]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Decisoes enviando={enviando} recorrencia={recorrencia} />
        </div>
      )}
      <ErroDaDecisao erro={erro} />
    </form>
  );
}
