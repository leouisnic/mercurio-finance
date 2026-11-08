import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { BarraDeFiltros } from "./barra-de-filtros";
import type { Ciclos } from "./buscar-movimentos";
import {
  enderecoDoFiltro,
  enderecoDaAnalise,
  intervaloDoPeriodo,
  lerFiltroDaBarra,
  temFiltroDeGasto,
} from "./filtro-da-barra";

const navegar = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navegar }) }));

const CICLOS: Ciclos = {
  anterior: { numero: 1, inicio: "2026-10-05", fim: "2026-10-14" },
  atual: { numero: 2, inicio: "2026-10-15", fim: "2026-11-04" },
  seguinte: { numero: 1, inicio: "2026-11-05", fim: "2026-11-15" },
};

test("o endereço guarda o filtro inteiro e volta igual", () => {
  const filtro = lerFiltroDaBarra({
    ciclo: "anterior",
    conta: ["a", "b"],
    categoria: "alimentacao",
    sem_tag: "3",
    referencia: "2026-08-10",
  });

  expect(filtro).toMatchObject({
    periodo: "anterior",
    contas: ["a", "b"],
    categorias: ["alimentacao"],
    semTag: 3,
  });
  expect(temFiltroDeGasto(filtro)).toBe(true);
  expect(enderecoDoFiltro("/movimentos", filtro, { pagina: 2 })).toBe(
    "/movimentos?ciclo=anterior&conta=a&conta=b&categoria=alimentacao&sem_tag=3&referencia=2026-08-10&pagina=2",
  );
});

test("datas inválidas e ciclo desconhecido caem no ciclo atual", () => {
  expect(
    lerFiltroDaBarra({ de: "2026-10-20", ate: "2026-10-01" }).periodo,
  ).toBe("atual");
  expect(lerFiltroDaBarra({ ciclo: "qualquer" }).periodo).toBe("atual");
  expect(enderecoDoFiltro("/", lerFiltroDaBarra({}))).toBe("/");
});

test("o período vira intervalo: ciclo com o anterior, mês do calendário e datas", () => {
  const atual = intervaloDoPeriodo(lerFiltroDaBarra({}), CICLOS, "2026-10-29");
  expect(atual).toMatchObject({
    inicio: "2026-10-15",
    fim: "2026-11-04",
    cicloAnterior: CICLOS.anterior,
  });

  const mesPassado = intervaloDoPeriodo(
    lerFiltroDaBarra({ mes: "anterior" }),
    CICLOS,
    "2026-10-29",
  );
  expect(mesPassado).toMatchObject({
    inicio: "2026-09-01",
    fim: "2026-09-30",
    rotulo: "Setembro de 2026",
    ciclo: null,
  });

  const datas = intervaloDoPeriodo(
    lerFiltroDaBarra({ de: "2026-10-01", ate: "2026-10-10" }),
    CICLOS,
    "2026-10-29",
  );
  expect(datas).toMatchObject({
    inicio: "2026-10-01",
    fim: "2026-10-10",
    ciclo: null,
    cicloAnterior: null,
  });
});

test("marcar uma conta na barra troca o endereço e mantém a referência", () => {
  navegar.mockReset();
  render(
    <BarraDeFiltros
      caminho="/movimentos"
      filtro={lerFiltroDaBarra({ referencia: "2026-08-10" })}
      rotuloDoPeriodo="Ciclo 2"
      hoje="2026-08-10"
      opcoes={{
        ciclos: [{ periodo: "atual", rotulo: "Ciclo 2", datas: "15/10 a 04/11" }],
        contas: [{ id: "conta-a", nome: "Conta A (fictícia)", tipo: "BANK", final: null }],
        categorias: [],
        tags: [],
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Todas as contas" }));
  fireEvent.click(screen.getByRole("button", { name: "Conta A (fictícia) Conta corrente" }));

  // scroll: false mantém a página onde estava ao filtrar.
  expect(navegar).toHaveBeenCalledWith(
    "/movimentos?conta=conta-a&referencia=2026-08-10",
    { scroll: false },
  );
});

test("navegar entre análises preserva seleções repetidas e elimina paginação", () => {
  const parametros = new URLSearchParams("conta=a&conta=b&categoria=casa&categoria=pet&mes=anterior&sem_tag=4&referencia=2026-08-10&pagina=3&busca=ignorar");
  const destino = enderecoDaAnalise("/movimentos", "/", parametros);
  expect(destino).toBe("/?mes=anterior&conta=a&conta=b&categoria=casa&categoria=pet&sem_tag=4&referencia=2026-08-10");
  expect(enderecoDaAnalise("/", "/movimentos", new URLSearchParams(destino.split("?")[1]))).toBe(destino.replace("/?", "/movimentos?"));
  expect(enderecoDaAnalise("/movimentos/tags", "/", parametros)).toBe("/");
  expect(enderecoDaAnalise("/", "/ajustes", parametros)).toBe("/ajustes");
});

test("voltar no filtro restaura o modo da tag antes da próxima seleção", () => {
  navegar.mockReset();
  const propriedades = {
    caminho: "/movimentos",
    rotuloDoPeriodo: "Período Exemplo",
    hoje: "2026-10-29",
    opcoes: {
      ciclos: [], contas: [], categorias: [],
      tags: [
        { id: 1, nome: "Viagem Exemplo", icone: "Tag", cor: 75 },
        { id: 2, nome: "Casa Exemplo", icone: "Tag", cor: 75 },
      ],
    },
  };
  const original = lerFiltroDaBarra({ com_tag: "1" });
  const { rerender } = render(<BarraDeFiltros {...propriedades} filtro={original} />);
  fireEvent.click(screen.getByRole("button", { name: "Só Viagem Exemplo" }));
  fireEvent.click(screen.getByRole("tab", { name: "Esconder" }));
  rerender(<BarraDeFiltros {...propriedades} filtro={lerFiltroDaBarra({ sem_tag: "1" })} />);
  rerender(<BarraDeFiltros {...propriedades} filtro={original} />);

  expect(screen.getByRole("tab", { name: "Mostrar só" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Casa Exemplo" }));
  expect(navegar).toHaveBeenLastCalledWith("/movimentos?com_tag=2", { scroll: false });
});

test("voltar no período restaura a aba e as datas confirmadas", () => {
  navegar.mockReset();
  const propriedades = {
    caminho: "/movimentos", rotuloDoPeriodo: "Período Exemplo", hoje: "2026-10-29",
    opcoes: { ciclos: [], contas: [], categorias: [], tags: [] },
  };
  const original = lerFiltroDaBarra({ de: "2026-10-01", ate: "2026-10-10" });
  const { rerender } = render(<BarraDeFiltros {...propriedades} filtro={original} />);
  fireEvent.click(screen.getByRole("button", { name: "Período Exemplo" }));
  fireEvent.click(screen.getByRole("button", { name: "Últimos 7 dias" }));
  rerender(<BarraDeFiltros {...propriedades} filtro={lerFiltroDaBarra({ de: "2026-10-20", ate: "2026-10-25" })} />);
  rerender(<BarraDeFiltros {...propriedades} filtro={original} />);
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
  expect(navegar).toHaveBeenLastCalledWith("/movimentos?de=2026-10-01&ate=2026-10-10", { scroll: false });

  fireEvent.click(screen.getByRole("tab", { name: "Meses" }));
  rerender(<BarraDeFiltros {...propriedades} filtro={lerFiltroDaBarra({ mes: "atual" })} />);
  rerender(<BarraDeFiltros {...propriedades} filtro={original} />);
  expect(screen.getByRole("tab", { name: "Datas" }).getAttribute("aria-selected")).toBe("true");
});
