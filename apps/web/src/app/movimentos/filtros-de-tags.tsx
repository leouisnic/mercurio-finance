"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip, OPCAO } from "../barra-de-filtros";
import {
  type FiltroDeTags,
  SITUACOES,
  TETOS,
  enderecoDosFiltrosDeTags,
} from "./filtro-de-tags";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Busca, ano e mês, situação e teto da página Tags, no padrão da barra de filtros. */
export function FiltrosDeTags({
  filtro,
  anos,
}: {
  filtro: FiltroDeTags;
  anos: number[];
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(filtro.busca);
  const ir = (novo: Partial<FiltroDeTags>) =>
    router.push(enderecoDosFiltrosDeTags({ ...filtro, ...novo }), {
      scroll: false,
    });
  const marcado = (sim: boolean) => (sim ? "text-marca font-bold" : "");
  const algum =
    Boolean(filtro.ano || filtro.busca) ||
    filtro.situacao !== "ativas" ||
    filtro.teto !== "todos";

  return (
    <div
      role="group"
      aria-label="Filtros das tags"
      className="flex flex-wrap items-center gap-2"
    >
      <form
        role="search"
        onSubmit={(evento) => {
          evento.preventDefault();
          ir({ busca: busca.trim() });
        }}
        className="border-borda bg-superficie focus-within:border-marca flex h-[34px] min-w-[200px] items-center gap-2 rounded-full border px-3"
      >
        <Search size={14} aria-hidden="true" className="text-tinta-3" />
        <input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar tag"
          aria-label="Buscar tag"
          className="w-full bg-transparent text-[13px] outline-none"
        />
      </form>

      <Chip
        rotulo={filtro.ano ? String(filtro.ano) : "Todos os anos"}
        ativo={Boolean(filtro.ano)}
      >
        <button
          type="button"
          className={OPCAO}
          onClick={() => ir({ ano: undefined, mes: undefined })}
        >
          <span className={marcado(!filtro.ano)}>Todos os anos</span>
        </button>
        {anos.map((ano) => (
          <button
            key={ano}
            type="button"
            className={OPCAO}
            onClick={() => ir({ ano, mes: undefined })}
          >
            <span className={marcado(filtro.ano === ano)}>{ano}</span>
          </button>
        ))}
      </Chip>

      {filtro.ano && (
        <Chip
          rotulo={filtro.mes ? MESES[filtro.mes - 1] : "Todos os meses"}
          ativo={Boolean(filtro.mes)}
        >
          <button
            type="button"
            className={OPCAO}
            onClick={() => ir({ mes: undefined })}
          >
            <span className={marcado(!filtro.mes)}>Todos os meses</span>
          </button>
          {MESES.map((nome, indice) => (
            <button
              key={nome}
              type="button"
              className={OPCAO}
              onClick={() => ir({ mes: indice + 1 })}
            >
              <span className={marcado(filtro.mes === indice + 1)}>{nome}</span>
            </button>
          ))}
        </Chip>
      )}

      <Chip
        rotulo={SITUACOES[filtro.situacao]}
        ativo={filtro.situacao !== "ativas"}
      >
        {(Object.keys(SITUACOES) as (keyof typeof SITUACOES)[]).map(
          (situacao) => (
            <button
              key={situacao}
              type="button"
              className={OPCAO}
              onClick={() => ir({ situacao })}
            >
              <span className={marcado(filtro.situacao === situacao)}>
                {SITUACOES[situacao]}
              </span>
            </button>
          ),
        )}
      </Chip>

      <Chip rotulo={TETOS[filtro.teto]} ativo={filtro.teto !== "todos"}>
        {(Object.keys(TETOS) as (keyof typeof TETOS)[]).map((teto) => (
          <button
            key={teto}
            type="button"
            className={OPCAO}
            onClick={() => ir({ teto })}
          >
            <span className={marcado(filtro.teto === teto)}>{TETOS[teto]}</span>
          </button>
        ))}
      </Chip>

      {algum && (
        <button
          type="button"
          onClick={() => {
            setBusca("");
            router.push("/movimentos/tags", { scroll: false });
          }}
          className="text-tinta-2 hover:text-tinta hover:bg-superficie-2 inline-flex h-[34px] items-center gap-1 rounded-full px-2.5 text-[13px]"
        >
          <X size={14} aria-hidden="true" /> Limpar filtros
        </button>
      )}
    </div>
  );
}
