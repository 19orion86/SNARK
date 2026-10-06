import "server-only"
import type { AssistantAnswer } from "@/lib/validators/assistant"

/**
 * Тестовый журнал ассистента в Google Таблице (как в прежнем n8n-боте).
 * Строка уходит в веб-приложение Apps Script, привязанное к таблице.
 * Включается только переменной ASSISTANT_SHEETS_WEBHOOK_URL: в таблицу попадают
 * ФИО и тексты вопросов, поэтому на проде без отдельного решения её не задают.
 */

const STATUS_LABELS: Record<AssistantAnswer["status"] | "error", string> = {
  answered: "Ответ дан",
  no_info: "Нет информации",
  contradiction: "Противоречие",
  error: "Ошибка",
}

const SEND_TIMEOUT_MS = 5000

export interface SheetsLogEntry {
  at: Date
  userId: string
  userName: string
  question: string
  answer: AssistantAnswer | null
  error?: string
}

/** Колонки таблицы: дата, id пользователя, id чата, имя, вопрос, ответ, источники, статус. */
export function buildSheetsRow(entry: SheetsLogEntry): string[] {
  const { answer } = entry
  const sources = (answer?.sources ?? [])
    .map((source) => {
      const version = source.version ? ` v${source.version}` : ""
      const section = source.section ? `, раздел ${source.section}` : ""
      return `${source.title}${version}${section}`
    })
    .join("; ")
  const status = answer
    ? STATUS_LABELS[answer.status]
    : `${STATUS_LABELS.error}: ${entry.error ?? "нет ответа"}`

  return [
    formatMoscowDateTime(entry.at),
    entry.userId,
    answer?.query_id ?? "—",
    entry.userName,
    entry.question,
    answer?.answer ?? "",
    sources,
    status,
  ].map(asPlainText)
}

/** Таблица выполняет ячейки, начинающиеся с =, + , - или @, как формулы; апостроф делает их текстом. */
function asPlainText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

export function formatMoscowDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(date)
    .replace(",", "")
}

/** Отправить строку в таблицу. Ошибки глотаются: журнал не должен ломать ответ ассистента. */
export async function sendToSheets(entry: SheetsLogEntry): Promise<boolean> {
  const url = process.env.ASSISTANT_SHEETS_WEBHOOK_URL?.trim()
  if (!url) return false
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ row: buildSheetsRow(entry) }),
      redirect: "follow",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      cache: "no-store",
    })
    return response.ok
  } catch {
    return false
  }
}
