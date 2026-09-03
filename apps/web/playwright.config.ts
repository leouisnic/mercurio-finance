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
      command: "uv run --package finance-api uvicorn finance_api.main:app --port 8100",
      cwd: "../..",
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
