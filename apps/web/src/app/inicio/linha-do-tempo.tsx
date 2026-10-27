import type { Ciclo } from "../buscar-movimentos";
import { comoData, diaEMes, diasEntre, porExtenso } from "../formato";
import { nomeDoCiclo, pagadorDoCiclo, type Pagadores } from "../pagadores";

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function diaSeguinte(iso: string): string {
  const dia = comoData(iso);
  dia.setDate(dia.getDate() + 1);
  const doisDigitos = (valor: number) => String(valor).padStart(2, "0");
  return `${dia.getFullYear()}-${doisDigitos(dia.getMonth() + 1)}-${doisDigitos(dia.getDate())}`;
}

function Marco({ posicao, pagador, data }: { posicao: number; pagador: string | null; data: string }) {
  const alinhamento =
    posicao === 0 ? "left-0" : posicao === 100 ? "right-0" : "-translate-x-1/2";
  return (
    <span
      style={posicao === 0 || posicao === 100 ? undefined : { left: `${posicao}%` }}
      className={`text-positivo absolute -top-5 text-[11px] font-semibold whitespace-nowrap ${alinhamento}`}
    >
      {pagador && <span className="hidden sm:inline">{pagador} </span>}
      {diaEMes(data)}
    </span>
  );
}

/** O ciclo atual, o seguinte e os três pagamentos que os delimitam. */
export function LinhaDoTempo({
  hoje,
  ciclo,
  cicloSeguinte,
  pagadores,
}: {
  hoje: string;
  ciclo: Ciclo;
  cicloSeguinte: Ciclo;
  pagadores: Pagadores;
}) {
  const diasDoAtual = diasEntre(comoData(ciclo.inicio), comoData(ciclo.fim)) + 1;
  const diasDoSeguinte = diasEntre(comoData(cicloSeguinte.inicio), comoData(cicloSeguinte.fim)) + 1;
  const total = diasDoAtual + diasDoSeguinte;
  const diaDoCiclo = diasEntre(comoData(ciclo.inicio), comoData(hoje)) + 1;
  const faltam = diasEntre(comoData(hoje), comoData(cicloSeguinte.inicio));
  const proximoPagador = pagadorDoCiclo(cicloSeguinte.numero, pagadores);
  const fimDoSeguinte = diaSeguinte(cicloSeguinte.fim);

  const larguraDoAtual = (diasDoAtual / total) * 100;
  const avancoNoAtual = ((diaDoCiclo - 0.5) / diasDoAtual) * 100;

  return (
    <section
      aria-label="Ciclos e pagamentos"
      className="bg-superficie border-borda flex flex-col gap-2.5 rounded-2xl border px-5 pt-4 pb-3.5"
    >
      <div className="text-tinta-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]">
        <span>
          <strong className="text-tinta">{maiuscula(porExtenso(comoData(hoje)))}</strong>
          {" · "}dia {diaDoCiclo} de {diasDoAtual} do {nomeDoCiclo(ciclo.numero, pagadores)}
        </span>
        <span>
          faltam <strong className="text-tinta">{faltam} {faltam === 1 ? "dia" : "dias"}</strong>{" "}
          {proximoPagador ? `para ${proximoPagador} pagar` : "para o próximo pagamento"}
        </span>
      </div>

      <div aria-hidden className="relative mt-5 mb-1.5 flex gap-[3px] sm:mb-7">
        <Marco posicao={0} pagador={pagadorDoCiclo(ciclo.numero, pagadores)} data={ciclo.inicio} />
        <Marco posicao={larguraDoAtual} pagador={proximoPagador} data={cicloSeguinte.inicio} />
        <Marco posicao={100} pagador={pagadorDoCiclo(ciclo.numero, pagadores)} data={fimDoSeguinte} />

        <div style={{ width: `${larguraDoAtual}%` }} className="bg-marca-clara relative h-2.5 rounded-full">
          <div style={{ width: `${avancoNoAtual}%` }} className="bg-marca h-full rounded-full" />
          <span
            style={{ left: `${avancoNoAtual}%` }}
            className="border-marca bg-superficie absolute -top-1 size-[18px] -translate-x-1/2 rounded-full border-[3px]"
          />
          <span className="text-tinta-2 absolute top-4 left-0 hidden text-xs whitespace-nowrap sm:inline">
            <b className="text-tinta">{nomeDoCiclo(ciclo.numero, pagadores)}</b> · {diaEMes(ciclo.inicio)} a{" "}
            {diaEMes(ciclo.fim)}
          </span>
        </div>
        <div className="bg-borda-sutil relative h-2.5 flex-1 rounded-full">
          <span className="text-tinta-2 absolute top-4 left-0 hidden text-xs whitespace-nowrap sm:inline">
            <b className="text-tinta">{nomeDoCiclo(cicloSeguinte.numero, pagadores)}</b> ·{" "}
            {diaEMes(cicloSeguinte.inicio)} a {diaEMes(cicloSeguinte.fim)}
          </span>
        </div>
      </div>

      <ul className="text-tinta-2 flex flex-col gap-1 text-xs sm:sr-only">
        <li>
          <b className="text-tinta">{nomeDoCiclo(ciclo.numero, pagadores)}</b> · {diaEMes(ciclo.inicio)} a{" "}
          {diaEMes(ciclo.fim)}
        </li>
        <li>
          <b className="text-tinta">{nomeDoCiclo(cicloSeguinte.numero, pagadores)}</b> ·{" "}
          {diaEMes(cicloSeguinte.inicio)} a {diaEMes(cicloSeguinte.fim)}
        </li>
      </ul>
    </section>
  );
}
