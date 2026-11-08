import {
  ArrowLeftRight,
  Flag,
  Landmark,
  Repeat,
  Shapes,
  Wallet,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { buscarDiasNaoUteis, buscarFeriados } from "../buscar-feriados";
import { dataDeHoje } from "../hoje";
import { BlocoIndisponivel } from "../indisponivel";
import { lerPagadores } from "../pagadores";
import { Feriados } from "./feriados";

type Secao = { nome: string; icone: ReactNode; cor: number; resumo?: string };

/** As seções que ainda não existem aparecem como "em breve": é aqui que vão morar. */
const PROXIMAS: Secao[] = [
  {
    nome: "Pagadores e ciclos",
    icone: <Wallet size={16} aria-hidden="true" />,
    cor: 278,
  },
  {
    nome: "Categorias",
    icone: <Shapes size={16} aria-hidden="true" />,
    cor: 150,
  },
  {
    nome: "Regras por destinatário",
    icone: <ArrowLeftRight size={16} aria-hidden="true" />,
    cor: 200,
  },
  { nome: "Contas", icone: <Landmark size={16} aria-hidden="true" />, cor: 27 },
  {
    nome: "Recorrências e compromissos",
    icone: <Repeat size={16} aria-hidden="true" />,
    cor: 300,
  },
];

function ItemDaSecao({ secao, ativa }: { secao: Secao; ativa: boolean }) {
  return (
    <li
      aria-current={ativa ? "page" : undefined}
      className={`flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl border px-2.5 py-2.5 ${
        ativa ? "bg-superficie border-borda shadow-sm" : "border-transparent"
      }`}
    >
      <span
        aria-hidden="true"
        className="categoria-bola grid size-[34px] shrink-0 place-items-center rounded-full"
        style={{ "--tom": secao.cor } as CSSProperties}
      >
        {secao.icone}
      </span>
      <span className="flex min-w-0 flex-col">
        <b className={`text-[13.5px] ${ativa ? "text-tinta" : "text-tinta-2"}`}>
          {secao.nome}
        </b>
        <span className="text-tinta-3 truncate text-[11.5px] max-md:hidden">
          {secao.resumo ?? "Em breve"}
        </span>
      </span>
    </li>
  );
}

/** Cadastros e regras do Mercúrio. Por enquanto só os feriados da cidade. */
export default async function Ajustes() {
  const ano = dataDeHoje().slice(0, 4);
  const [feriados, naoUteis] = await Promise.all([
    buscarFeriados(),
    buscarDiasNaoUteis(`${ano}-01-01`, `${ano}-12-31`),
  ]);
  const pagadores = lerPagadores();
  const nomes = {
    ciclo1: pagadores.ciclo1 ?? "Quem paga o ciclo 1",
    ciclo2: pagadores.ciclo2 ?? "Quem paga o ciclo 2",
  };
  // Os nacionais são os feriados do ano que não estão no cadastro da cidade.
  const daCidade = new Set((feriados ?? []).map((feriado) => feriado.nome));
  const nacionais = (naoUteis ?? []).flatMap((dia) =>
    dia.feriado && !daCidade.has(dia.feriado)
      ? [{ data: dia.data, nome: dia.feriado }]
      : [],
  );
  const feriadosDaSecao: Secao = {
    nome: "Feriados",
    icone: <Flag size={16} aria-hidden="true" />,
    cor: 175,
    resumo: feriados
      ? `${feriados.length} da cidade · ${nacionais.length} nacionais`
      : undefined,
  };

  return (
    <>
      <header className="flex flex-col gap-[3px]">
        <h1 className="text-[23px] font-bold tracking-[-0.2px]">Ajustes</h1>
        <span className="text-tinta-3 text-[13px]">
          Cadastros e regras que mudam os números do Mercúrio.
        </span>
      </header>
      <div className="grid min-w-0 gap-4 md:grid-cols-[250px_minmax(0,1fr)] md:items-start">
        <nav
          aria-label="Seções de ajustes"
          className="min-w-0 max-md:overflow-x-auto"
        >
          <ul className="m-0 flex list-none gap-1.5 p-0 md:flex-col">
            <ItemDaSecao secao={feriadosDaSecao} ativa />
            {PROXIMAS.map((secao) => (
              <ItemDaSecao key={secao.nome} secao={secao} ativa={false} />
            ))}
          </ul>
        </nav>
        {feriados === null ? (
          <BlocoIndisponivel titulo="Feriados" rotulo="Feriados" />
        ) : (
          <Feriados feriados={feriados} nomes={nomes} nacionais={nacionais} hoje={dataDeHoje()} />
        )}
      </div>
    </>
  );
}
