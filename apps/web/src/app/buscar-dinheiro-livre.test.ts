import { expect, test, vi } from "vitest";
import { buscarDinheiroLivre } from "./buscar-dinheiro-livre";

const api = vi.hoisted(() => ({ buscarJson: vi.fn() }));
vi.mock("./api", () => ({ ...api, paraNumero: Number }));

test.each(["negative_estimate", "insufficient_history", null])(
  "preserva a ausência da sugestão e seu motivo: %s",
  async (reason) => {
    api.buscarJson.mockResolvedValueOnce({
      hoje: "2026-10-10",
      ciclo: { numero: 1, inicio: "2026-10-05", fim: "2026-10-14" },
      ciclo_seguinte: { numero: 2, inicio: "2026-10-15", fim: "2026-11-04" },
      saldo_contas: "100.00", cartao_usado: "0.00", contas_fixas: [],
      contas_fixas_total: "0.00", caixinha: "0.00", livre: "100.00",
      dias_do_ciclo: 10, dias_restantes: 5, cota_do_dia: "10.00",
      cofrinho: "0.00", gasto_hoje: "0.00", hoje_disponivel: "10.00",
      guardado_no_ciclo: "0.00", guardado_em: null, da_para_guardar: null,
      savings_suggestion_reason: reason, falta_para_fechar: "0.00", gastos_por_dia: [],
    });

    const result = await buscarDinheiroLivre("2026-10-10");

    expect(result?.daParaGuardar).toBeNull();
    expect(result?.savingsSuggestionReason).toBe(reason);
  },
);
