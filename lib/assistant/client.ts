import "server-only"
import { getProtocolsApiUrl } from "@/lib/protocols/client"

export class AssistantUnavailableError extends Error {
  constructor(message = "Сервис ассистента недоступен") {
    super(message)
    this.name = "AssistantUnavailableError"
  }
}

/**
 * Запрос к API ассистента в Python-сервисе (`/api/v1/assistant/*`).
 * Все маршруты ассистента внутренние: добавляем X-Internal-Token.
 * Сессию пользователя проверяет портал до вызова.
 */
export async function assistantRequest(path: string, init?: RequestInit): Promise<Response> {
  const token = process.env.INTERNAL_TOKEN?.trim()
  if (!token) {
    throw new AssistantUnavailableError("INTERNAL_TOKEN не настроен на портале")
  }
  const headers = new Headers(init?.headers)
  headers.set("X-Internal-Token", token)
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }
  try {
    return await fetch(getProtocolsApiUrl(`/api/v1/assistant${path}`), {
      ...init,
      headers,
      cache: "no-store",
    })
  } catch {
    throw new AssistantUnavailableError()
  }
}

export type AssistantSourceType = "document" | "article"

/**
 * Поставить источник на индексацию. Ошибки не пробрасываются: публикация
 * документа не должна падать из-за недоступности ассистента — расхождение
 * подберёт периодическая сверка в Python-сервисе.
 */
export async function requestReindex(type: AssistantSourceType, id: string): Promise<boolean> {
  try {
    const response = await assistantRequest(`/sources/${type}/${id}/reindex`, { method: "POST" })
    return response.ok || response.status === 404
  } catch {
    return false
  }
}
