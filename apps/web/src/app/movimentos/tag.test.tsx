import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { ResumoDaTag, Tag } from "../buscar-movimentos";
import { ProvedorDeDicas } from "../info";
import { FormularioDeTag } from "./formulario-de-tag";
import { achadosDaTag } from "./leitura";
import { ListaDeTags, textoDoTeto } from "./tag";

const acoes = vi.hoisted(() => ({
  salvarTag: vi.fn(),
  arquivarTag: vi.fn(),
  apagarTag: vi.fn(),
}));
vi.mock("../acoes", () => acoes);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const TAG: Tag = {
  id: 1,
  nome: "viagem Exemplo",
  icone: "Plane",
  cor: 220,
  teto: 9000,
  inicio: "2026-10-02",
  fim: "2026-10-16",
  arquivada: false,
  gasto: 7420,
  quantidade: 23,
  primeiraData: "2026-10-02",
  ultimaData: "2026-10-16",
};

beforeEach(() => {
  acoes.salvarTag.mockReset();
  acoes.salvarTag.mockResolvedValue({ erro: null });
});

// O Intl separa "R$" do número com espaço que não quebra linha.
const espacos = (texto: string | null) => texto?.replace(/\s/g, " ") ?? null;

test("o teto vira uma frase, e sem teto não aparece nada", () => {
  expect(espacos(textoDoTeto(TAG))).toBe("Faltam R$ 1.580,00 de R$ 9.000,00");
  expect(espacos(textoDoTeto({ gasto: 3870.5, teto: 3000 }))).toBe(
    "Passou R$ 870,50 do teto de R$ 3.000,00",
  );
  expect(textoDoTeto({ gasto: 640, teto: null })).toBeNull();
});

test("o cartão mostra movimentos e período por extenso, e a arquivada vai para o fim", () => {
  render(
    <ListaDeTags
      tags={[
        { ...TAG, id: 2, nome: "viagem Antiga", arquivada: true, teto: null },
        TAG,
      ]}
    />,
  );

  const nomes = screen
    .getAllByRole("link", { name: /viagem/ })
    .map((link) => link.textContent);
  expect(nomes.indexOf("viagem Exemplo")).toBeLessThan(
    nomes.indexOf("viagem Antiga"),
  );
  expect(screen.getAllByText("23 movimentos")).toHaveLength(2);
  expect(screen.getAllByText("2 a 16 de outubro")).toHaveLength(2);
  expect(screen.queryByText(/sem teto/i)).toBeNull();
  expect(screen.getByText("arquivada")).toBeDefined();
});

function resumoDe(
  dias: [string, number][],
  campos: Partial<ResumoDaTag> = {},
): ResumoDaTag {
  let soma = 0;
  const acumulado = dias.map(([data, total]) => ({
    data,
    total: (soma += total),
  }));
  return {
    ...TAG,
    gasto: soma,
    porCategoria: [],
    dias: dias.length,
    porDia: soma / dias.length,
    maiores: [],
    diaMaisCaro: null,
    acumulado,
    categoriaPrincipal: null,
    impacto: null,
    ...campos,
  };
}

const CATEGORIAS = (id: string) =>
  id === "alimentacao"
    ? { nome: "Alimentação", icone: "Utensils", cor: 45 }
    : undefined;

test("os achados só aparecem quando se aplicam e trocam o título conforme o dado", () => {
  // 5 a 11 de outubro de 2026: segunda a domingo, com o fim de semana pesado.
  const semana = resumoDe(
    [
      ["2026-10-05", 50],
      ["2026-10-06", 50],
      ["2026-10-07", 50],
      ["2026-10-08", 50],
      ["2026-10-09", 400],
      ["2026-10-10", 600],
      ["2026-10-11", 300],
    ],
    {
      categoriaPrincipal: {
        categoria: "alimentacao",
        total: 1000,
        tipicoPorCiclo: 400,
      },
      teto: null,
      fim: null,
    },
  );

  const achados = achadosDaTag(semana, CATEGORIAS, "2026-10-20");
  const porId = Object.fromEntries(
    achados.map((achado) => [achado.id, achado]),
  );

  expect(achados.map((achado) => achado.id)).toEqual([
    "categoria",
    "concentrado",
    "semana",
    "ritmo",
    "sem-gasto",
  ]);
  expect(porId.categoria.titulo).toBe("Alimentação acima do normal");
  expect(porId.categoria.valor).toBe("2,5×");
  expect(porId.semana.titulo).toBe("Fim de semana pesou");
  expect(porId.semana.valor).toBe("87%");
  expect(porId.ritmo.titulo).toBe("Ritmo subiu");
  expect(porId["sem-gasto"].valor).toBe("0 de 7");
});

test("previsão para o teto só com o período em andamento", () => {
  const dias: [string, number][] = [
    ["2026-10-05", 100],
    ["2026-10-06", 100],
    ["2026-10-07", 100],
  ];
  const emAndamento = resumoDe(dias, { teto: 1000, fim: "2026-10-10" });
  const encerrada = resumoDe(dias, { teto: 1000, fim: "2026-10-07" });

  const previsao = achadosDaTag(emAndamento, CATEGORIAS, "2026-10-07").find(
    (achado) => achado.id === "previsao",
  );

  // 300 gastos, 100 por dia nos últimos dias, 3 dias até o fim: fecha em 600.
  expect(espacos(previsao?.valor ?? null)).toBe("R$ 600,00");
  expect(previsao?.positivo).toBe(true);
  expect(
    achadosDaTag(encerrada, CATEGORIAS, "2026-10-20").some(
      (achado) => achado.id === "previsao",
    ),
  ).toBe(false);
});

test("tag sem gasto não tem achados", () => {
  expect(achadosDaTag(resumoDe([]), CATEGORIAS, "2026-10-20")).toEqual([]);
});

test("criar tag com atalho de teto manda os dados e fecha", async () => {
  const fechar = vi.fn();
  render(
    <ProvedorDeDicas>
      <FormularioDeTag fechar={fechar} />
    </ProvedorDeDicas>,
  );

  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "viagem Rio" },
  });
  fireEvent.click(screen.getByRole("button", { name: /6\.000/ }));
  fireEvent.click(screen.getByRole("button", { name: "Criar tag" }));

  await waitFor(() => expect(fechar).toHaveBeenCalled());
  expect(acoes.salvarTag).toHaveBeenCalledWith(
    {
      nome: "viagem Rio",
      icone: "Plane",
      cor: 200,
      teto: 6000,
      inicio: null,
      fim: null,
    },
    undefined,
  );
});
