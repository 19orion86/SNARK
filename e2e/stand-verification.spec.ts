import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test"
import { credentials, isoDate, type E2ERole } from "./helpers"

/**
 * Проверка на живом Postgres пунктов TZ v2, которые были отмечены [x] «по коду»,
 * но не проверялись на стенде: миграции 0020/0021 (kanban-проекты, шаблоны,
 * automation rules, опросы, закрепы, папки, поиск), комментарии к заявкам,
 * цепочка согласования отпусков, уведомления без SMTP.
 */

async function apiLogin(
  playwright: typeof import("@playwright/test")["request"],
  baseURL: string,
  role: E2ERole
): Promise<APIRequestContext> {
  const context = await playwright.newContext({ baseURL })
  const response = await context.post("/api/auth/login", { data: credentials(role) })
  expect(response.status(), `login ${role}`).toBe(200)
  return context
}

async function ok(response: APIResponse, label: string): Promise<Record<string, unknown>> {
  const text = await response.text()
  expect(response.status(), `${label}: ${text.slice(0, 300)}`).toBeLessThan(300)
  return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}

let admin: APIRequestContext
let hr: APIRequestContext
let employee: APIRequestContext
let employeeId: string
const stamp = Date.now()

test.beforeAll(async ({ playwright, baseURL }) => {
  admin = await apiLogin(playwright.request, baseURL!, "admin")
  hr = await apiLogin(playwright.request, baseURL!, "hr_manager")
  employee = await apiLogin(playwright.request, baseURL!, "employee")
  const me = await ok(await employee.get("/api/users/me"), "users/me")
  employeeId = (me.profile as { userId: string }).userId
})

test.afterAll(async () => {
  await Promise.all([admin?.dispose(), hr?.dispose(), employee?.dispose()])
})

test("задачи: проект, шаблон, чек-лист, комментарий, завершение (миграции 0020/0021)", async () => {
  const project = await ok(
    await admin.post("/api/task-projects", { data: { name: `E2E проект ${stamp}`, color: "#2563eb" } }),
    "создание проекта"
  )
  const projectId = ((project.item ?? project) as { id: string }).id
  expect(projectId).toBeTruthy()

  await ok(
    await admin.post("/api/task-templates", {
      data: { name: `E2E шаблон ${stamp}`, title: "Задача из шаблона", checklist: ["Шаг 1", "Шаг 2"] },
    }),
    "создание шаблона"
  )

  // Назначение на другого пользователя порождает уведомление: без SMTP не должно быть 500.
  const created = await ok(
    await admin.post("/api/tasks", {
      data: { title: `E2E стенд ${stamp}`, projectId, assigneeId: employeeId, dueDate: isoDate(2) },
    }),
    "создание задачи с исполнителем (уведомление без SMTP)"
  )
  const taskId = (created.item as { id: string }).id

  await ok(await admin.post(`/api/tasks/${taskId}/checklist`, { data: { title: "Пункт чек-листа" } }), "чек-лист")
  await ok(await employee.post(`/api/tasks/${taskId}/comments`, { data: { body: "Комментарий исполнителя" } }), "комментарий")
  await ok(await admin.get(`/api/tasks/${taskId}/activity`), "лента активности")
  await ok(
    await employee.post(`/api/tasks/${taskId}/complete`, { multipart: { completionResult: "Сделано" } }),
    "завершение задачи"
  )

  const notifications = await ok(await employee.get("/api/notifications"), "уведомления исполнителя")
  expect(Array.isArray(notifications.items)).toBe(true)
})

test("automation rules: создание и список (только admin)", async () => {
  await ok(
    await admin.post("/api/automation-rules", {
      data: { name: `E2E правило ${stamp}`, trigger: "task.overdue", action: "notify.assignee", isActive: false },
    }),
    "создание правила"
  )
  await ok(await admin.get("/api/automation-rules"), "список правил")
  expect((await employee.get("/api/automation-rules")).status()).toBe(403)
})

test("чат: канал, сообщение, реакция, закреп, опрос, папка, поиск", async () => {
  const channel = await ok(
    await admin.post("/api/chat/channels", {
      data: { type: "group", name: `E2E канал ${stamp}`, memberIds: [employeeId] },
    }),
    "создание канала"
  )
  const channelId = ((channel.item ?? channel.channel ?? channel) as { id: string }).id
  expect(channelId).toBeTruthy()

  const marker = `маркер${stamp}`
  const message = await ok(
    await admin.post(`/api/chat/channels/${channelId}/messages`, { data: { body: `Сообщение ${marker}` } }),
    "отправка сообщения"
  )
  const messageId = ((message.item ?? message.message ?? message) as { id: string }).id

  await ok(
    await employee.post(`/api/chat/channels/${channelId}/messages/${messageId}/reactions`, { data: { emoji: "👍" } }),
    "реакция"
  )
  await ok(await admin.post(`/api/chat/channels/${channelId}/pins`, { data: { messageId } }), "закреп")
  await ok(await employee.get(`/api/chat/channels/${channelId}/pins`), "список закрепов")

  const poll = await ok(
    await admin.post(`/api/chat/channels/${channelId}/polls`, {
      data: { question: "Когда планёрка?", options: ["Утром", "Вечером"] },
    }),
    "создание опроса"
  )
  const pollBody = JSON.stringify(poll)
  const pollId = /"poll":\{"id":"([0-9a-f-]{36})"/.exec(pollBody)?.[1]
  const optionId = /"options":\[\{"id":"([0-9a-f-]{36})"/.exec(pollBody)?.[1]
  expect(pollId, `ответ опроса: ${pollBody.slice(0, 300)}`).toBeTruthy()
  await ok(await employee.post(`/api/chat/polls/${pollId}/vote`, { data: { optionId } }), "голос в опросе")

  await ok(await employee.post("/api/chat/folders", { data: { name: `E2E папка ${stamp}` } }), "папка чатов")

  // Список каналов: последнее сообщение и счётчик непрочитанных приходят из БД.
  const list = await ok(await employee.get("/api/chat/channels"), "список каналов")
  const listed = (list.items as Array<{ id: string; lastMessage: { body: string } | null; unreadCount: number }>).find(
    (item) => item.id === channelId
  )
  expect(listed?.lastMessage?.body ?? "", "последнее сообщение в списке каналов").not.toBe("")
  expect(listed?.unreadCount, "непрочитанные для участника").toBeGreaterThan(0)

  const search = await ok(await employee.get(`/api/chat/search?q=${marker}`), "поиск по чату")
  expect(JSON.stringify(search)).toContain(marker)

  const outsider = await hr.get(`/api/chat/channels/${channelId}/messages`)
  expect(outsider.status(), "не участник не читает канал").toBeGreaterThanOrEqual(403)
})

test("заявки: создание, комментарии сотрудника и администратора, смена статуса", async () => {
  const categories = await ok(await employee.get("/api/ticket-categories"), "категории")
  const slug = (categories.items as Array<{ slug: string }>)[0].slug
  const created = await ok(
    await employee.post("/api/tickets", { data: { category: slug, subject: `E2E стенд заявка ${stamp}` } }),
    "создание заявки"
  )
  const ticketId = (created.item as { id: string }).id

  await ok(await employee.post(`/api/tickets/${ticketId}/comments`, { data: { body: "Уточнение автора" } }), "комментарий автора")
  await ok(await admin.post(`/api/tickets/${ticketId}/comments`, { data: { body: "Ответ поддержки" } }), "комментарий администратора")
  const comments = await ok(await employee.get(`/api/tickets/${ticketId}/comments`), "список комментариев")
  expect((comments.items as unknown[]).length).toBeGreaterThanOrEqual(2)

  await ok(await admin.patch(`/api/admin/tickets/${ticketId}`, { data: { status: "in_progress" } }), "смена статуса")
  await ok(await admin.post("/api/tasks/from-ticket", { data: { ticketId } }), "задача из заявки")

  const foreign = await hr.get(`/api/tickets/${ticketId}/comments`)
  expect([200, 403, 404]).toContain(foreign.status())
})

test("отпуск: заявление и цепочка согласования manager → hr", async () => {
  const offset = 400 + (stamp % 150)
  const created = await ok(
    await employee.post("/api/vacations", {
      data: { startDate: isoDate(offset), endDate: isoDate(offset + 6), type: "annual" },
    }),
    "заявление на отпуск"
  )
  const vacationId = ((created.item ?? created) as { id: string }).id
  expect(vacationId).toBeTruthy()

  await ok(await employee.get(`/api/vacations/${vacationId}/approvals`), "шаги согласования")
  expect(
    (await employee.post(`/api/vacations/${vacationId}/approvals`, { data: { step: "manager", status: "approved" } })).status(),
    "сотрудник не согласует свой отпуск"
  ).toBe(403)

  await ok(
    await hr.post(`/api/vacations/${vacationId}/approvals`, { data: { step: "manager", status: "approved" } }),
    "шаг manager"
  )
  await ok(
    await hr.post(`/api/vacations/${vacationId}/approvals`, { data: { step: "hr", status: "approved" } }),
    "шаг hr"
  )

  const list = await ok(await employee.get("/api/vacations"), "мои отпуска")
  const mine = (list.items as Array<{ id: string; status: string }>).find((item) => item.id === vacationId)
  expect(mine?.status).toBe("approved")
})

test("CRM и виджеты дашборда: запись и чтение", async () => {
  await ok(await admin.post("/api/deals", { data: { title: `E2E сделка ${stamp}`, amount: 150000 } }), "создание сделки")
  await ok(await admin.get("/api/deals"), "список сделок")
  await ok(
    await employee.put("/api/dashboard/widgets", {
      data: { items: [{ widgetType: "news", sortOrder: 0, enabled: true }, { widgetType: "my_tasks", sortOrder: 1, enabled: false }] },
    }),
    "сохранение виджетов"
  )
  const widgets = await ok(await employee.get("/api/dashboard/widgets"), "чтение виджетов")
  expect((widgets.items as unknown[]).length).toBe(2)
})
