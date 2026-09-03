import { defineConfig, devices } from "@playwright/test";

const FINANCE_API_URL = "http://localhost:8100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
  },
  webServer: [
    {
      // finance-api real, não mock: o e2e prova que apps/web e finance-api
      // conversam de verdade, não só que a UI sabe formatar dado fictício.
      // Aponta pro banco de TESTE (semeado com o extrato fictício), nunca
      // pro banco de desenvolvimento, que guarda dado real do Pluggy.
      command:
        "uv run --package finance-api python -m finance_api.seed && uv run --package finance-api uvicorn finance_api.main:app --port 8100",
      cwd: "../..",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql+asyncpg://mercurio:mercurio@127.0.0.1:5432/mercurio_test",
      },
      url: `${FINANCE_API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npm run dev -- --port 3100",
      url: "http://localhost:3100",
      env: { FINANCE_API_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
