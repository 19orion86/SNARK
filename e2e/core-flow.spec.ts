import { expect, test } from "@playwright/test"
import { isoDate, loginViaUi } from "./helpers"

/**
 * Сквозной сценарий сотрудника на живом Postgres:
 * login → dashboard → задача → чат задачи → заявка → отпуск.
 * Данные создаются через те же API, что вызывает UI (в сессии браузера),
 * а результат проверяется на страницах портала.
 */
test("сотрудник: вход, задача, чат, заявка, отпуск", async ({ page }) => {
  const stamp = Date.now()
  const taskTitle = `E2E задача ${stamp}`
  const ticketSubject = `E2E заявка ${stamp}`
  const chatText = `E2E сообщение ${stamp}`

  await test.step("вход и дашборд", async () => {
    await loginViaUi(page, "employee")
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByText("Последние новости")).toBeVisible()
  })

  const taskId = await test.step("создание задачи", async () => {
    const response = await page.request.post("/api/tasks", {
      data: { title: taskTitle, priority: "high", dueDate: isoDate(3) },
    })
    expect(response.status()).toBe(201)
    const body = (await response.json()) as { item: { id: string; title: string } }
    expect(body.item.title).toBe(taskTitle)

    await page.goto("/tasks")
    await expect(page.getByText(taskTitle).first()).toBeVisible()
    return body.item.id
  })

  await test.step("чат задачи", async () => {
    const chat = await page.request.get(`/api/tasks/${taskId}/chat`)
    expect(chat.ok()).toBeTruthy()
    const { channelId } = (await chat.json()) as { channelId: string }
    expect(channelId).toBeTruthy()

    const sent = await page.request.post(`/api/chat/channels/${channelId}/messages`, {
      data: { body: chatText },
    })
    expect(sent.status()).toBeLessThan(300)

    await page.goto(`/tasks/${taskId}`)
    await expect(page.getByText(taskTitle).first()).toBeVisible()
    await expect(page.getByText(chatText).first()).toBeVisible()
  })

  await test.step("заявка в поддержку", async () => {
    const categories = await page.request.get("/api/ticket-categories")
    expect(categories.ok()).toBeTruthy()
    const { items } = (await categories.json()) as { items: Array<{ slug: string }> }
    expect(items.length).toBeGreaterThan(0)

    const created = await page.request.post("/api/tickets", {
      data: { category: items[0].slug, subject: ticketSubject, description: "Создано E2E-тестом" },
    })
    expect(created.status()).toBe(201)

    await page.goto("/support")
    await expect(page.getByText(ticketSubject).first()).toBeVisible()
  })

  await test.step("заявление на отпуск", async () => {
    const offset = 200 + (stamp % 100)
    const created = await page.request.post("/api/vacations", {
      data: { startDate: isoDate(offset), endDate: isoDate(offset + 6), type: "annual" },
    })
    expect(created.status()).toBeLessThan(300)

    const list = await page.request.get("/api/vacations")
    expect(list.ok()).toBeTruthy()
    const body = (await list.json()) as { items: Array<{ startDate: string; status: string }> }
    expect(body.items.some((item) => item.startDate === isoDate(offset))).toBe(true)

    await page.goto("/profile")
    await expect(page.getByText("Отпуск").first()).toBeVisible()
  })
})
