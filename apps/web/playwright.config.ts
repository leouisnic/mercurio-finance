import { defineConfig, devices } from "@playwright/test";

// 127.0.0.1 e não localhost: o painel e a API só escutam em IPv4, e no
// Windows localhost pode resolver primeiro para ::1.
const FINANCE_API_URL = "http://127.0.0.1:8100";
const PAINEL_URL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: PAINEL_URL,
  },
  webServer: [
    {
      // finance-api real, não mock: o e2e prova que apps/web e finance-api
      // conversam de verdade, não só que a UI sabe formatar dado fictício.
      // Aponta pro banco de TESTE (semeado com o extrato fictício), nunca
      // pro banco de desenvolvimento, que guarda dado real do Pluggy.
      command:
        "uv run --package finance-api python -m finance_api.seed --reset-test && uv run --package finance-api uvicorn finance_api.main:app --port 8100",
      cwd: "../..",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql+asyncpg://mercurio:mercurio@127.0.0.1:5432/mercurio_test",
      },
      url: `${FINANCE_API_URL}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        "node node_modules/next/dist/bin/next build && node node_modules/next/dist/bin/next start -H 127.0.0.1 --port 3100",
      url: PAINEL_URL,
      env: {
        FINANCE_API_URL,
        NEXT_DIST_DIR: ".next-e2e",
        // A base fictícia é de agosto de 2026; fixar o dia mantém o ciclo
        // corrente com movimentos e os números conferíveis à mão.
        MERCURIO_HOJE: "2026-08-10",
        PAGADOR_CICLO_1: "Empresa A",
        PAGADOR_CICLO_2: "Empresa B",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  // Os testes que gravam na base fictícia só rodam depois que todos os de
  // leitura passaram, em série, e restauram a base antes de cada tentativa:
  // rodando junto, uma recorrência aprovada sumiria da fila que outro teste lê.
  projects: [
    {
      name: "leitura",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /\.mutavel\.spec\.ts$/,
    },
    {
      name: "mutavel",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /\.mutavel\.spec\.ts$/,
      dependencies: ["leitura"],
      fullyParallel: false,
    },
  ],
});
