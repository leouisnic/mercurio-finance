import {
  ArrowDownUp,
  CalendarCheck,
  CalendarRange,
  Flame,
  Gem,
  TrendingUp,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { Categoria, Contadores } from "./buscar-movimentos";
import { mes, moeda, primeiraMaiuscula } from "./formato";

function Cartao({
  icone,
  cor,
  titulo,
  valor,
  apoio,
  apagado = false,
  tom = "text-tinta",
  children,
}: {
  icone: ReactNode;
  cor: number;
  titulo: string;
  valor: string;
  apoio: string;
  apagado?: boolean;
  tom?: string;
  children?: ReactNode;
}) {
  return (
    <article
      aria-label={titulo}
      className="bg-superficie border-borda flex min-w-0 flex-col gap-2.5 rounded-2xl border p-4"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="categoria-bola grid size-8 shrink-0 place-items-center rounded-full"
          style={{ "--tom": cor } as CSSProperties}
        >
          {icone}
        </span>
        <b
          className="text-tinta text-[13.5px] leading-tight sm:truncate"
          title={titulo}
        >
          {titulo}
        </b>
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span
          className={`num truncate text-[24px] leading-none font-bold tracking-[-0.4px] max-sm:text-[19px] ${apagado ? "text-tinta-3" : tom}`}
        >
          {valor}
        </span>
        <span className="text-tinta-2 truncate text-[12.5px]" title={apoio}>
          {apoio}
        </span>
      </span>
      {children}
    </article>
  );
}

const dias = (quantos: number) => (quantos === 1 ? "1 dia" : `${quantos} dias`);
const comSinal = (valor: number) =>
  `${valor > 0 ? "+" : valor < 0 ? "−" : ""} ${moeda(Math.abs(valor))}`.trim();

/**
 * Os contadores do período: dias de ouro, sequência sem gasto, dentro da cota
 * e a comparação com o mesmo ciclo do mês anterior em cima; dia útil contra
 * não útil e a categoria que mais cresceu embaixo, mais largos. Todos do
 * mesmo tamanho na sua linha, que se ajusta à tela.
 */
export function CartoesDeContadores({
  contadores,
  cotaNegativa = false,
  nomeDoCicloComparado,
  categorias = [],
}: {
  contadores: Contadores;
  /** Livre negativo: toda cota seria "passou", então o contador não conta. */
  cotaNegativa?: boolean;
  /** "Ciclo Empresa B": o título da comparação, com o nome de quem paga. */
  nomeDoCicloComparado: string | null;
  categorias?: Categoria[];
}) {
  const { comparacao, cicloComparado, diaUtil, categoriaQueCresceu } =
    contadores;
  const diferenca = comparacao
    ? comparacao.gasto - comparacao.gastoAnterior
    : 0;
  const titulo = nomeDoCicloComparado
    ? `Vs ${nomeDoCicloComparado}`
    : "Vs mesmo ciclo";
  const categoria = categoriaQueCresceu
    ? (categorias.find((item) => item.id === categoriaQueCresceu.categoria)
        ?.nome ?? categoriaQueCresceu.categoria)
    : null;
  const parte = diaUtil ? Math.round(diaUtil.parteNaoUtil * 100) : 0;
  return (
    <section aria-label="Contadores" className="flex flex-col gap-2.5 md:gap-3">
      <div className="grid grid-cols-2 gap-2.5 md:gap-3 lg:grid-cols-4">
        <Cartao
          icone={<Gem size={16} aria-hidden="true" />}
          cor={75}
          titulo="Dias de ouro"
          valor={`${contadores.diasDeOuro} de ${contadores.dias}`}
          apoio={`${contadores.diasDeOuroNoTotal} no total`}
        />
        <Cartao
          icone={<Flame size={16} aria-hidden="true" />}
          cor={150}
          titulo="Sequência sem gasto"
          valor={dias(contadores.sequencia)}
          apoio={`Recorde: ${dias(contadores.recorde)}`}
        />
        {contadores.dentroDaCota === null ? (
          <Cartao
            icone={<CalendarCheck size={16} aria-hidden="true" />}
            cor={278}
            titulo="Dentro da cota"
            valor="Sem cota"
            apoio={
              cotaNegativa
                ? "O livre do ciclo está negativo"
                : "Sem cota guardada para o período"
            }
            apagado
          />
        ) : (
          <Cartao
            icone={<CalendarCheck size={16} aria-hidden="true" />}
            cor={278}
            titulo="Dentro da cota"
            valor={`${contadores.dentroDaCota} de ${contadores.dias}`}
            apoio={
              contadores.acimaDaCota === 1
                ? "1 dia passou"
                : `${dias(contadores.acimaDaCota ?? 0)} passaram`
            }
          />
        )}
        {comparacao === null || cicloComparado === null ? (
          <Cartao
            icone={<ArrowDownUp size={16} aria-hidden="true" />}
            cor={278}
            titulo="Vs mesmo ciclo"
            valor="Sem comparação"
            apoio="Só quando o período é um ciclo"
            apagado
          />
        ) : (
          <Cartao
            icone={<ArrowDownUp size={16} aria-hidden="true" />}
            cor={diferenca > 0 ? 27 : 150}
            titulo={titulo}
            valor={comSinal(diferenca)}
            apoio={`${moeda(comparacao.gastoAnterior)} em ${mes(cicloComparado.inicio)}, mesmo dia`}
            tom={diferenca > 0 ? "text-alerta" : "text-positivo"}
          />
        )}
      </div>
      <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
        {diaUtil === null ? (
          <Cartao
            icone={<CalendarRange size={16} aria-hidden="true" />}
            cor={345}
            titulo="Dia útil vs não útil"
            valor="Sem gasto"
            apoio="Nada gasto no período"
            apagado
          />
        ) : (
          <Cartao
            icone={<CalendarRange size={16} aria-hidden="true" />}
            cor={345}
            titulo="Dia útil vs não útil"
            valor={`${parte}% não útil`}
            apoio={
              diaUtil.diaMaisCaro
                ? `${primeiraMaiuscula(diaUtil.diaMaisCaro)} é o dia mais caro, ${moeda(diaUtil.mediaDoDiaMaisCaro)} em média`
                : "Sem dia mais caro"
            }
          >
            <span
              className="flex h-1.5 overflow-hidden rounded-full"
              aria-hidden
            >
              <i
                className="bg-marca block"
                style={{ width: `${100 - parte}%` }}
              />
              <i className="bg-nao-util block" style={{ width: `${parte}%` }} />
            </span>
          </Cartao>
        )}
        <Cartao
          icone={<TrendingUp size={16} aria-hidden="true" />}
          cor={45}
          titulo="Categoria que mais cresceu"
          valor={categoria ?? "Nenhuma cresceu"}
          apoio={
            categoriaQueCresceu && nomeDoCicloComparado && cicloComparado
              ? `+ ${moeda(categoriaQueCresceu.aumento)} vs ${nomeDoCicloComparado} de ${mes(cicloComparado.inicio)}`
              : "Só quando o período é um ciclo"
          }
          apagado={categoria === null}
        />
      </div>
    </section>
  );
}
