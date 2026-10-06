import { after, NextRequest, NextResponse } from "next/server"
import { assistantRequest } from "@/lib/assistant/client"
import { assistantErrorResponse, invalidPayloadResponse } from "@/lib/assistant/respond"
import { sendToSheets } from "@/lib/assistant/sheets-log"
import { requireAuth } from "@/lib/auth/request-auth"
import { loadUserNames } from "@/lib/repositories/assistant.repository"
import {
  assistantAnswerSchema,
  assistantAskSchema,
  type AssistantAnswer,
} from "@/lib/validators/assistant"
import { apiErrorSchema } from "@/lib/validators/portal"

export const dynamic = "force-dynamic"

function logToSheetsAfterResponse(
  userId: string,
  question: string,
  answer: AssistantAnswer | null,
  error?: string
) {
  if (!process.env.ASSISTANT_SHEETS_WEBHOOK_URL?.trim()) return
  const at = new Date()
  after(async () => {
    const names = await loadUserNames([userId]).catch(() => new Map<string, string>())
    await sendToSheets({ at, userId, userName: names.get(userId) ?? "—", question, answer, error })
  })
}

/**
 * Вопрос ассистенту. Портал передаёт в Python только user_id из JWT и текст вопроса:
 * роль и отдел сервис читает из БД сам, из запроса браузера они не берутся.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const parsed = assistantAskSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return invalidPayloadResponse(parsed.error.issues[0]?.message)
    }
    const question = parsed.data.question

    const upstream = await assistantRequest("/ask", {
      method: "POST",
      body: JSON.stringify({ user_id: auth.userId, question }),
    })

    if (upstream.status === 502) {
      logToSheetsAfterResponse(auth.userId, question, null, "языковая модель не ответила")
      return NextResponse.json(
        apiErrorSchema.parse({
          error: "Не удалось получить ответ от языковой модели. Попробуйте ещё раз позже.",
          code: "ASSISTANT_LLM_ERROR",
        }),
        { status: 502 }
      )
    }
    if (!upstream.ok) {
      logToSheetsAfterResponse(auth.userId, question, null, "сервис ассистента недоступен")
      return NextResponse.json(
        apiErrorSchema.parse({
          error: "Сервис ассистента недоступен",
          code: "ASSISTANT_UNAVAILABLE",
        }),
        { status: 503 }
      )
    }

    const answer = assistantAnswerSchema.parse(await upstream.json())
    logToSheetsAfterResponse(auth.userId, question, answer)
    return NextResponse.json(answer)
  } catch (error) {
    return assistantErrorResponse(error)
  }
}
