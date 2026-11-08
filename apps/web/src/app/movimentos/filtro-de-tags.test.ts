import { expect, test } from "vitest";
import type { Tag } from "../buscar-movimentos";
import {
  anosDasTags,
  enderecoDosFiltrosDeTags,
  filtrarTags,
  lerFiltroDeTags,
} from "./filtro-de-tags";

const tag = (campos: Partial<Tag>): Tag => ({
  id: 1,
  nome: "viagem Exemplo",
  icone: "Plane",
  cor: 200,
  teto: null,
  inicio: null,
  fim: null,
  arquivada: false,
  gasto: 0,
  quantidade: 0,
  primeiraData: null,
  ultimaData: null,
  ...campos,
});

const TAGS = [
  tag({
    id: 1,
    nome: "Viagem Exemplo",
    inicio: "2026-12-20",
    fim: "2027-01-05",
    teto: 4000,
    gasto: 4500,
  }),
  tag({
    id: 2,
    nome: "reforma Exemplo",
    primeiraData: "2026-09-01",
    ultimaData: "2026-09-30",
    teto: 2000,
    gasto: 900,
  }),
  tag({
    id: 3,
    nome: "presentes",
    primeiraData: "2025-12-10",
    ultimaData: "2025-12-20",
    arquivada: true,
  }),
];
const nomes = (tags: Tag[]) => tags.map((item) => item.id);

test("ano e mês pegam a tag cujo período passa por eles, sem depender do nome", () => {
  expect(
    nomes(filtrarTags(TAGS, lerFiltroDeTags({ ano: "2027" }), "2026-11-05")),
  ).toEqual([1]);
  expect(
    nomes(
      filtrarTags(
        TAGS,
        lerFiltroDeTags({ ano: "2026", mes: "9" }),
        "2026-11-05",
      ),
    ),
  ).toEqual([2]);
  expect(
    nomes(
      filtrarTags(
        TAGS,
        lerFiltroDeTags({ ano: "2026", mes: "12" }),
        "2026-11-05",
      ),
    ),
  ).toEqual([1]);
  expect(anosDasTags(TAGS)).toEqual([2027, 2026, 2025]);
});

test("situação, teto e busca sem acento", () => {
  expect(nomes(filtrarTags(TAGS, lerFiltroDeTags({}), "2026-11-05"))).toEqual([
    1, 2,
  ]);
  expect(
    nomes(
      filtrarTags(
        TAGS,
        lerFiltroDeTags({ situacao: "arquivadas" }),
        "2026-11-05",
      ),
    ),
  ).toEqual([3]);
  // A viagem termina em janeiro de 2027: em 10 de janeiro, está encerrada.
  expect(
    nomes(
      filtrarTags(
        TAGS,
        lerFiltroDeTags({ situacao: "encerradas" }),
        "2027-01-10",
      ),
    ),
  ).toEqual([1]);
  expect(
    nomes(filtrarTags(TAGS, lerFiltroDeTags({ teto: "passou" }), "2026-11-05")),
  ).toEqual([1]);
  expect(
    nomes(
      filtrarTags(
        TAGS,
        lerFiltroDeTags({ teto: "sem", situacao: "todas" }),
        "2026-11-05",
      ),
    ),
  ).toEqual([3]);
  expect(
    nomes(
      filtrarTags(TAGS, lerFiltroDeTags({ busca: "VIAGEM" }), "2026-11-05"),
    ),
  ).toEqual([1]);
});

test("o endereço guarda só o que foi escolhido", () => {
  expect(enderecoDosFiltrosDeTags(lerFiltroDeTags({}))).toBe(
    "/movimentos/tags",
  );
  expect(
    enderecoDosFiltrosDeTags(
      lerFiltroDeTags({ ano: "2026", mes: "9", teto: "com", busca: " praia " }),
    ),
  ).toBe("/movimentos/tags?ano=2026&mes=9&teto=com&busca=praia");
  // Mês sem ano não vale.
  expect(lerFiltroDeTags({ mes: "9" }).mes).toBeUndefined();
});
