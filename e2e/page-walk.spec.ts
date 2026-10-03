import { mkdirSync, writeFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"
import { loginViaUi, type E2ERole } from "./helpers"

/**
 * Обход всех страниц портала под каждой ролью.
 * Проверяет: страница отвечает, нет необработанных исключений и 5xx,
 * сотрудник не попадает в /admin. Попутно пишет LCP и замечания
 * в e2e/.report/page-walk.json — это вход для BUGS.md и PERF-BASELINE.md.
 */

const COMMON_PAGES = [
  "/dashboard", "/news", "/contacts", "/structure", "/documents", "/knowledge",
  "/protocols", "/tasks", "/crm", "/chat", "/profile", "/support", "/calendar",
  "/booking", "/about", "/vacations/calendar",
]

const ADMIN_PAGES = [
  "/admin", "/admin/employees", "/admin/departments", "/admin/news", "/admin/knowledge",
  "/admin/ticket-sla", "/admin/support-categories", "/admin/vacations", "/admin/tasks",
  "/admin/chat", "/admin/structure-import",
]

const ADMIN_ONLY_PAGES = ["/admin/users", "/admin/tickets"]

// Сервис протоколов в E2E не поднят: 502/503 от его прокси — ожидаемое поведение.
const EXPECTED_UPSTREAM_DOWN = /\/api\/protocols/

interface PageReport {
  role: E2ERole
  path: string
  status: number | null
  finalUrl: string
  lcpMs: number | null
  consoleErrors: string[]
  pageErrors: string[]
  serverErrors: string[]
}

const report: PageReport[] = []

async function readLcp(page: Page): Promise<number | null> {
  return page.evaluate(
    () =>
      new Promise<number | null>((resolve) => {
        let lcp: number | null = null
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = entry.startTime
        })
        observer.observe({ type: "largest-contentful-paint", buffered: true })
        setTimeout(() => {
          observer.disconnect()
          resolve(lcp === null ? null : Math.round(lcp))
        }, 400)
      })
  )
}

async function visit(page: Page, role: E2ERole, path: string): Promise<PageReport> {
  const entry: PageReport = {
    role,
    path,
    status: null,
    finalUrl: "",
    lcpMs: null,
    consoleErrors: [],
    pageErrors: [],
    serverErrors: [],
  }
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === "error") entry.consoleErrors.push(message.text().slice(0, 300))
  }
  const onPageError = (error: Error) => entry.pageErrors.push(error.message.slice(0, 300))
  const onResponse = (response: { status(): number; url(): string }) => {
    if (response.status() >= 500 && !EXPECTED_UPSTREAM_DOWN.test(response.url())) {
      entry.serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`)
    }
  }
  page.on("console", onConsole)
  page.on("pageerror", onPageError)
  page.on("response", onResponse)

  const response = await page.goto(path, { waitUntil: "load" })
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
  entry.status = response?.status() ?? null
  entry.finalUrl = new URL(page.url()).pathname
  entry.lcpMs = await readLcp(page)

  page.off("console", onConsole)
  page.off("pageerror", onPageError)
  page.off("response", onResponse)
  report.push(entry)
  return entry
}

test.afterAll(() => {
  mkdirSync("e2e/.report", { recursive: true })
  writeFileSync("e2e/.report/page-walk.json", JSON.stringify(report, null, 2), "utf8")
})

for (const role of ["admin", "hr_manager", "employee"] as const) {
  test(`обход страниц: ${role}`, async ({ page }) => {
    test.setTimeout(240_000)
    await loginViaUi(page, role)

    const allowedAdminPages =
      role === "admin" ? [...ADMIN_PAGES, ...ADMIN_ONLY_PAGES] : role === "hr_manager" ? ADMIN_PAGES : []

    for (const path of [...COMMON_PAGES, ...allowedAdminPages]) {
      const entry = await visit(page, role, path)
      expect.soft(entry.status, `${role} ${path}: HTTP-статус`).toBe(200)
      expect.soft(entry.finalUrl, `${role} ${path}: без редиректа`).toBe(path)
      expect.soft(entry.pageErrors, `${role} ${path}: исключения в браузере`).toEqual([])
      expect.soft(entry.serverErrors, `${role} ${path}: ответы 5xx`).toEqual([])
    }

    if (role === "employee") {
      for (const path of [...ADMIN_PAGES, ...ADMIN_ONLY_PAGES]) {
        const entry = await visit(page, role, path)
        expect.soft(entry.status, `employee не должен открывать ${path}`).not.toBe(200)
      }
    }

    if (role === "hr_manager") {
      for (const path of ADMIN_ONLY_PAGES) {
        const entry = await visit(page, role, path)
        expect.soft(entry.finalUrl, `hr_manager не должен оставаться на ${path}`).not.toBe(path)
      }
    }
  })
}
