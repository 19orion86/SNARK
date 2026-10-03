import { config } from "dotenv"
import { defineConfig, devices } from "@playwright/test"

config({ path: ".env.local" })

const port = Number(process.env.E2E_PORT ?? 3100)
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`

/**
 * E2E идут против production-сборки на живом Postgres (USE_MOCK_DB=false).
 * Перед запуском: `pnpm db:migrate && pnpm init:users && pnpm build`.
 * Если сервер уже поднят, задайте E2E_BASE_URL — тогда webServer не стартует.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.output",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next start -p ${port}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
