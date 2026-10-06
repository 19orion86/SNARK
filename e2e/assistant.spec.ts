import { expect, test, type APIRequestContext } from "@playwright/test"
import { credentials, loginViaUi } from "./helpers"

/**
 * Ассистент по базе знаний: публикация документа → вопрос → ответ с источником →
 * переход к документу; архивный документ пропадает из ответов.
 *
 * Требует запущенный сервис ассистента (services/protocols) и демо-документ:
 *   python services/protocols/scripts/make_demo_docx.py <dir> && pnpm seed:content <dir>
 * Без сервиса сьют пропускается (в CI включается переменной E2E_ASSISTANT=1).
 */

const DEMO_TITLE = "E2E Регламент адаптации (демо)"
const QUESTION = "Сколько длится испытательный срок у специалиста?"

interface RagDocument {
  id: string
  title: string
  ragStatus: string
  indexState: string | null
  indexError: string | null
  chunkCount: number
}

async function adminContext(
  playwright: typeof import("@playwright/test")["request"],
  baseURL: string
): Promise<APIRequestContext> {
  const context = await playwright.newContext({ baseURL })
  expect((await context.post("/api/auth/login", { data: credentials("admin") })).status()).toBe(200)
  return context
}

async function findDemo(admin: APIRequestContext): Promise<{ document?: RagDocument; available: boolean }> {
  const response = await admin.get("/api/admin/assistant/documents")
  expect(response.ok()).toBeTruthy()
  const body = (await response.json()) as { items: RagDocument[]; assistantAvailable: boolean }
  return { document: body.items.find((item) => item.title === DEMO_TITLE), available: body.assistantAvailable }
}

async function setStatus(admin: APIRequestContext, id: string, ragStatus: string): Promise<void> {
  const response = await admin.patch(`/api/admin/documents/${id}/rag-status`, { data: { ragStatus } })
  expect(response.status(), await response.text()).toBe(200)
}

let admin: APIRequestContext
let demoId: string

test.beforeAll(async ({ playwright, baseURL }) => {
  admin = await adminContext(playwright.request, baseURL!)
  const { document, available } = await findDemo(admin)
  const required = process.env.E2E_ASSISTANT === "1"
  if (!required) {
    test.skip(!available, "сервис ассистента не запущен")
    test.skip(!document, "демо-документ не загружен (pnpm seed:content)")
  }
  expect(available, "сервис ассистента доступен").toBe(true)
  expect(document, "демо-документ загружен").toBeTruthy()
  demoId = document!.id
})

test.afterAll(async () => {
  await admin?.dispose()
})

test("публикация документа индексирует его", async () => {
  await setStatus(admin, demoId, "actual")

  await expect
    .poll(async () => (await findDemo(admin)).document?.indexState, { timeout: 120_000, intervals: [1000] })
    .toBe("indexed")
  const { document } = await findDemo(admin)
  expect(document?.indexError).toBeNull()
  expect(document?.chunkCount).toBeGreaterThanOrEqual(3)

  // Повторная публикация без изменений не создаёт дублей (K7).
  const reindex = await admin.post(`/api/admin/documents/${demoId}/reindex`)
  expect(reindex.status()).toBe(202)
  await expect
    .poll(async () => (await findDemo(admin)).document?.chunkCount, { timeout: 60_000 })
    .toBe(document?.chunkCount)
})

test("сотрудник: вопрос → ответ с источником → переход к документу", async ({ page }) => {
  await loginViaUi(page, "employee")
  await page.getByRole("link", { name: /Ассистент/ }).first().click()
  await expect(page).toHaveURL(/\/assistant$/)

  await page.locator("#assistant-question").fill(QUESTION)
  await page.getByRole("button", { name: "Отправить вопрос" }).click()

  const answer = page.getByTestId("assistant-answer").last()
  await expect(answer).toBeVisible({ timeout: 60_000 })
  await expect(answer).toHaveAttribute("data-status", "answered")
  await expect(answer).toContainText("три месяца")

  const source = answer.getByTestId("assistant-source").first()
  await expect(source).toContainText(DEMO_TITLE)
  await expect(source).toContainText("раздел 2. Испытательный срок")

  await answer.getByRole("button", { name: "Ответ полезен" }).click()
  await expect(answer.getByRole("button", { name: "Ответ полезен" })).toHaveAttribute("aria-pressed", "true")

  await source.click()
  await expect(page).toHaveURL(/\/documents\?search=/)
  await expect(page.getByText(DEMO_TITLE).first()).toBeVisible()
})

test("вопрос вне базы знаний получает no_info без источников", async ({ page }) => {
  await loginViaUi(page, "employee")
  await page.goto("/assistant")
  await page.locator("#assistant-question").fill("Какая погода будет завтра в Казани?")
  await page.getByRole("button", { name: "Отправить вопрос" }).click()

  const answer = page.getByTestId("assistant-answer").last()
  await expect(answer).toBeVisible({ timeout: 60_000 })
  await expect(answer).toHaveAttribute("data-status", "no_info")
  await expect(answer.getByTestId("assistant-source")).toHaveCount(0)
})

test("журнал обращений виден admin и закрыт для сотрудника", async ({ playwright, baseURL }) => {
  const log = await admin.get("/api/admin/assistant/queries?status=answered")
  expect(log.ok()).toBeTruthy()
  const body = (await log.json()) as { items: Array<{ question: string; feedback: number | null }> }
  const mine = body.items.find((item) => item.question === QUESTION)
  expect(mine, "вопрос записан в журнал").toBeTruthy()
  expect(mine?.feedback).toBe(1)

  const employee = await playwright.request.newContext({ baseURL: baseURL! })
  await employee.post("/api/auth/login", { data: credentials("employee") })
  expect((await employee.get("/api/admin/assistant/queries")).status()).toBe(403)
  expect((await employee.patch(`/api/admin/documents/${demoId}/rag-status`, { data: { ragStatus: "draft" } })).status()).toBe(403)
  await employee.dispose()
})

test("архивный документ пропадает из ответов (K6)", async ({ playwright, baseURL }) => {
  await setStatus(admin, demoId, "archived")

  const employee = await playwright.request.newContext({ baseURL: baseURL! })
  await employee.post("/api/auth/login", { data: credentials("employee") })
  const started = Date.now()
  const response = await employee.post("/api/assistant/ask", { data: { question: QUESTION } })
  expect(response.ok()).toBeTruthy()
  const answer = (await response.json()) as { status: string; sources: Array<{ source_id: string }> }
  await employee.dispose()

  expect(answer.sources.map((source) => source.source_id)).not.toContain(demoId)
  expect(Date.now() - started).toBeLessThan(60_000)

  await expect
    .poll(async () => (await findDemo(admin)).document?.indexState ?? null, { timeout: 60_000 })
    .toBeNull()

  // Возвращаем документ в актуальное состояние для повторных прогонов.
  await setStatus(admin, demoId, "actual")
})
