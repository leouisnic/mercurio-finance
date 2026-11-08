import { expect, test, vi } from "vitest";
import { buscarContadores } from "./buscar-movimentos";

const buscar = vi.hoisted(() => vi.fn());
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()), buscarJson: buscar,
}));

const BASE = {
  dias: 3, dias_de_ouro: 1, dias_de_ouro_no_total: 30, sequencia: 1, recorde: 29,
  dentro_da_cota: 2, acima_da_cota: 1, comparacao: { gasto: "130.00", gasto_anterior: "100.00" },
};

test("converte o contrato dos contadores e mantém os filtros repetidos", async () => {
  buscar.mockResolvedValue({
    ...BASE, cota: "50.00", ciclo_comparado: { numero: 1, inicio: "2026-09-04", fim: "2026-09-14" },
    dia_util: { parte_nao_util: "0.75", dia_mais_caro: "sábado", media_do_dia_mais_caro: "300.00" },
    categoria_que_cresceu: { categoria: "casa", aumento: "30.00" },
  });
  const resposta = await buscarContadores("2026-10-05", "2026-10-14", "2026-10-07", 50, { contas: ["a", "b"], categorias: ["casa", "pet"] }, true);
  expect(resposta).toMatchObject({
    cota: 50, comparacao: { gasto: 130, gastoAnterior: 100 },
    cicloComparado: { numero: 1, inicio: "2026-09-04" },
    diaUtil: { parteNaoUtil: 0.75, diaMaisCaro: "sábado", mediaDoDiaMaisCaro: 300 },
    categoriaQueCresceu: { categoria: "casa", aumento: 30 },
  });
  expect(buscar).toHaveBeenLastCalledWith("/contadores", expect.objectContaining({ conta_id: ["a", "b"], categoria: ["casa", "pet"], sem_conta_fixa: true }));
});

test("falha continua indisponível e resposta antiga não fabrica cota ou comparação", async () => {
  buscar.mockResolvedValue(null);
  const consultar = () => buscarContadores("2026-10-05", "2026-10-14", "2026-10-07", null, {}, false);
  expect(await consultar()).toBeNull();
  buscar.mockResolvedValue(BASE);
  expect(await consultar()).toMatchObject({ cota: null, cicloComparado: null, comparacao: null, diaUtil: null, categoriaQueCresceu: null });
});
