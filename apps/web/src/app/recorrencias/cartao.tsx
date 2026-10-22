"use client";

import { type FormEvent, useState, useTransition } from "react";
import { SeloDoBanco, nomeDaConta } from "../banco";
import type { Conta } from "../buscar-resumo";
import { CATEGORIAS, ROTULO_DA_CATEGORIA, type Recorrencia } from "../buscar-recorrencias";
import { decidirRecorrencia } from "../acoes";
import { diaEMes, moeda } from "../formato";

function Identificacao({ recorrencia, conta }: { recorrencia: Recorrencia; conta?: Conta }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {conta && <SeloDoBanco conta={conta} tamanho={26} />}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13.5px] font-semibold" title={recorrencia.descricao}>
          {recorrencia.apelido ?? recorrencia.descricao}
        </span>
        <span className="text-tinta-3 truncate text-[10.5px]">
          {recorrencia.apelido ? `${recorrencia.descricao} · ` : ""}
          {conta ? nomeDaConta(conta) : recorrencia.contaId}
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
 * `submitter`, que é o que diz se é aprovar ou rejeitar.
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
    <p role="alert" className="bg-alerta-fundo text-alerta rounded-[9px] px-3 py-2 text-[12.5px]">
      {erro}
    </p>
  ) : null;
}

function Historico({ recorrencia }: { recorrencia: Recorrencia }) {
  return (
    <span className="text-tinta-3 text-[11.5px]">
      {recorrencia.ocorrencias} cobranças, de {diaEMes(recorrencia.primeiraData)} a{" "}
      {diaEMes(recorrencia.ultimaData)}
    </span>
  );
}

/** Uma candidata na fila: identificação, histórico e a decisão. */
export function CartaoPendente({
  recorrencia,
  conta,
}: {
  recorrencia: Recorrencia;
  conta?: Conta;
}) {
  const campo = `recorrencia-${recorrencia.id}`;
  const { erro, enviando, enviar } = useDecisao();

  return (
    <form
      onSubmit={enviar}
      className="bg-superficie border-borda flex flex-col gap-3.5 rounded-2xl border p-5"
    >
      <input type="hidden" name="id" value={recorrencia.id} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <Identificacao recorrencia={recorrencia} conta={conta} />
        <span className="flex flex-col items-end">
          <span className="num text-gasto text-[19px] font-semibold">
            {moeda(recorrencia.valorMedio)}
          </span>
          <Historico recorrencia={recorrencia} />
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="text-tinta-3 text-[11px] font-semibold tracking-[0.04em] uppercase">
            Apelido
          </span>
          <input
            type="text"
            name="apelido"
            id={`${campo}-apelido`}
            defaultValue={recorrencia.apelido ?? ""}
            placeholder="Como você chama isso"
            maxLength={100}
            className="border-borda bg-superficie focus:border-marca rounded-[9px] border px-3 py-2 text-[13px] outline-none"
          />
        </label>

        <label className="flex min-w-[150px] flex-col gap-1">
          <span className="text-tinta-3 text-[11px] font-semibold tracking-[0.04em] uppercase">
            Categoria
          </span>
          <select
            name="categoria"
            id={`${campo}-categoria`}
            defaultValue={recorrencia.categoria ?? ""}
            className="border-borda bg-superficie focus:border-marca rounded-[9px] border px-3 py-2 text-[13px] outline-none"
          >
            <option value="">Sem categoria</option>
            {CATEGORIAS.map((opcao) => (
              <option key={opcao} value={opcao}>
                {ROTULO_DA_CATEGORIA[opcao]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={enviando}
            name="status"
            value="aprovada"
            className="bg-positivo cursor-pointer rounded-[9px] disabled:cursor-wait disabled:opacity-60 px-4 py-2 text-[13px] font-semibold text-white"
          >
            Aprovar
          </button>
          <button
            type="submit"
            disabled={enviando}
            name="status"
            value="rejeitada"
            title="A detecção não devolve esta recorrência para a fila depois de rejeitada"
            className="border-borda text-tinta-2 hover:bg-superficie-2 cursor-pointer rounded-[9px] disabled:cursor-wait disabled:opacity-60 border px-4 py-2 text-[13px] font-semibold"
          >
            Rejeitar
          </button>
        </div>
      </div>
      <ErroDaDecisao erro={erro} />
    </form>
  );
}

/** Uma já decidida: mostra o que ficou e permite voltar atrás. */
export function LinhaDecidida({
  recorrencia,
  conta,
}: {
  recorrencia: Recorrencia;
  conta?: Conta;
}) {
  const aprovada = recorrencia.status === "aprovada";
  const { erro, enviando, enviar } = useDecisao();

  return (
    <form
      onSubmit={enviar}
      className="border-borda-sutil flex flex-wrap items-center justify-between gap-3 border-b px-[22px] py-3 last:border-b-0"
    >
      <input type="hidden" name="id" value={recorrencia.id} />
      <Identificacao recorrencia={recorrencia} conta={conta} />

      <div className="flex flex-wrap items-center gap-3">
        {recorrencia.categoria && (
          <span className="bg-marca-clara text-marca-escura rounded-full px-2.5 py-1 text-[10.5px] font-semibold">
            {ROTULO_DA_CATEGORIA[recorrencia.categoria]}
          </span>
        )}
        <span className="num text-tinta-2 text-[13px] font-semibold">
          {moeda(recorrencia.valorMedio)}
        </span>
        <button
          type="submit"
          disabled={enviando}
          name="status"
          value={aprovada ? "rejeitada" : "aprovada"}
          className="border-borda text-tinta-2 hover:bg-superficie-2 cursor-pointer rounded-[9px] disabled:cursor-wait disabled:opacity-60 border px-3 py-1.5 text-[12px]"
        >
          {aprovada ? "Rejeitar" : "Aprovar"}
        </button>
      </div>
      {erro && (
        <div className="basis-full">
          <ErroDaDecisao erro={erro} />
        </div>
      )}
    </form>
  );
}
