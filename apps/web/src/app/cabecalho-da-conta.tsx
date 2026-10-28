"use client";

import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { renomearConta } from "./acoes";
import { SeloDoBanco, nomeDaConta } from "./banco";
import type { Conta } from "./buscar-resumo";

function Lapis() {
  return (
    <svg
      aria-hidden
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

const BOTAO =
  "cursor-pointer rounded-[9px] border px-3.5 py-2 text-[13px] font-semibold disabled:cursor-wait disabled:opacity-60";

/**
 * Nome da conta com o renomear no próprio card. Envia por `onSubmit`, não
 * pelo `action` do formulário, pelo mesmo motivo dos cartões de
 * recorrência: o React reinicia o formulário ao fim de toda ação, inclusive
 * a que falhou, e o nome digitado tem de sobreviver ao erro.
 */
export function CabecalhoDaConta({
  conta,
  subtitulo,
  direita,
}: {
  conta: Conta;
  subtitulo: string;
  /** O selo de saldo na conta corrente, o logo da bandeira no cartão. */
  direita?: ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(conta.apelido ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const nome = nomeDaConta(conta);
  const campo = `apelido-${conta.id}`;

  const [salvando, iniciar] = useTransition();

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const submitter = (evento.nativeEvent as SubmitEvent).submitter;
    const dados = new FormData(evento.currentTarget, submitter);
    iniciar(async () => {
      const resultado = await renomearConta(dados);
      setErro(resultado.erro);
      if (resultado.erro === null) {
        setEditando(false);
      }
    });
  }

  function cancelar() {
    setTexto(conta.apelido ?? "");
    setErro(null);
    setEditando(false);
  }

  if (!editando) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-[11px]">
          <SeloDoBanco conta={conta} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="flex min-w-0 items-center gap-1">
              {/* Nome longo trunca em vez de quebrar o card em duas linhas: a
                  Pluggy devolve coisas como "Nu Pagamentos S.A. - Instituição
                  de Pagamento (Conta Pré-paga)". */}
              <span className="min-w-0 truncate text-base font-semibold" title={conta.nome}>
                {nome}
              </span>
              <button
                type="button"
                aria-label={`Renomear ${nome}`}
                onClick={() => {
                  setTexto(conta.apelido ?? "");
                  setEditando(true);
                }}
                className="text-tinta-3 hover:bg-superficie-2 hover:text-marca grid shrink-0 cursor-pointer place-items-center rounded-[7px] p-1"
              >
                <Lapis />
              </button>
            </span>
            <span className="text-tinta-2 truncate text-[13px]">{subtitulo}</span>
          </span>
        </div>
        {direita}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-[11px]">
        <SeloDoBanco conta={conta} />
        <form
          onSubmit={salvar}
          aria-label={`Renomear ${nome}`}
          className="flex min-w-0 flex-1 flex-col gap-2"
        >
          <input type="hidden" name="conta_id" value={conta.id} />
          <label htmlFor={campo} className="text-tinta-3 text-[13px]">
            Apelido da conta
          </label>
          <div className="flex flex-wrap gap-1.5">
            <input
              id={campo}
              type="text"
              name="apelido"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              maxLength={100}
              autoFocus
              className="border-borda bg-superficie focus:outline-marca min-w-0 flex-[1_1_160px] rounded-[9px] border px-3 py-2 text-[14px] focus:outline-2 focus:outline-offset-1"
            />
            <button
              type="submit"
              disabled={salvando}
              className={`${BOTAO} bg-marca border-marca text-sobre-cor`}
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={cancelar}
              className={`${BOTAO} bg-superficie border-borda text-tinta-2 hover:bg-superficie-2`}
            >
              Cancelar
            </button>
          </div>
          {conta.apelido !== null && (
            <button
              type="submit"
              name="limpar"
              value="1"
              disabled={salvando}
              className="text-marca cursor-pointer self-start text-left text-[13px] hover:underline"
            >
              Voltar ao nome do banco: {conta.nome}
            </button>
          )}
        </form>
      </div>
      {erro && (
        <p
          role="alert"
          className="bg-alerta-fundo text-alerta rounded-[9px] px-3 py-2 text-[12.5px]"
        >
          {erro}
        </p>
      )}
    </div>
  );
}
