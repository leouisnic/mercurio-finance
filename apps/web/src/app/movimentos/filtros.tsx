import Link from "next/link";
import { SeloDoBanco, nomeDaConta } from "../banco";
import type { Ciclo } from "../buscar-movimentos";
import type { Conta } from "../buscar-resumo";
import { diaEMes } from "../formato";

/**
 * Os filtros são links, não botões com estado: cada combinação é uma URL
 * própria, então recarregar a página ou compartilhar o link cai no mesmo
 * recorte. Quem filtra de verdade é o servidor.
 */

function Pilula({
  href,
  ativo,
  children,
}: {
  href: string;
  ativo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "true" : undefined}
      className={
        ativo
          ? "bg-marca flex items-center gap-1.5 rounded-full px-3.5 py-[7px] text-[12.5px] font-semibold text-white"
          : "bg-superficie border-borda text-tinta-2 hover:bg-superficie-2 flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] text-[12.5px]"
      }
    >
      {children}
    </Link>
  );
}

function url(ciclo: string, contaId: string | undefined, referencia?: string): string {
  const query = new URLSearchParams({ ciclo });
  if (contaId) {
    query.set("conta", contaId);
  }
  if (referencia) {
    query.set("referencia", referencia);
  }
  return `/movimentos?${query}`;
}

export function Filtros({
  ciclos,
  cicloEscolhido,
  contas,
  contaEscolhida,
  referencia,
}: {
  ciclos: { chave: string; ciclo: Ciclo }[];
  cicloEscolhido: string;
  contas: Conta[];
  contaEscolhida: string | undefined;
  referencia?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <nav aria-label="Ciclo" className="flex flex-wrap items-center gap-1.5">
        {ciclos.map(({ chave, ciclo }) => (
          <Pilula
            key={chave}
            href={url(chave, contaEscolhida, referencia)}
            ativo={chave === cicloEscolhido}
          >
            Ciclo {ciclo.numero} · {diaEMes(ciclo.inicio)} a {diaEMes(ciclo.fim)}
          </Pilula>
        ))}
      </nav>

      <nav aria-label="Conta" className="flex flex-wrap items-center gap-1.5">
        <Pilula
          href={url(cicloEscolhido, undefined, referencia)}
          ativo={contaEscolhida === undefined}
        >
          Todas as contas
        </Pilula>
        {contas.map((conta) => (
          <Pilula
            key={conta.id}
            href={url(cicloEscolhido, conta.id, referencia)}
            ativo={contaEscolhida === conta.id}
          >
            <SeloDoBanco nome={conta.nome} tamanho={16} />
            {nomeDaConta(conta.nome)} · {conta.tipo === "CREDIT" ? "Cartão" : "Conta"}
          </Pilula>
        ))}
      </nav>
    </div>
  );
}
