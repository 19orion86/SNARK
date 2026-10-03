import { NextRequest, NextResponse } from "next/server"
import { assistantRequest } from "@/lib/assistant/client"
import { assistantErrorResponse, invalidPayloadResponse } from "@/lib/assistant/respond"
import { requireAuth } from "@/lib/auth/request-auth"
import { assistantAnswerSchema, assistantAskSchema } from "@/lib/validators/assistant"
import { apiErrorSchema } from "@/lib/validators/portal"

export const dynamic = "force-dynamic"

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

    const upstream = await assistantRequest("/ask", {
      method: "POST",
      body: JSON.stringify({ user_id: auth.userId, question: parsed.data.question }),
    })

    if (upstream.status === 502) {
      return NextResponse.json(
        apiErrorSchema.parse({
          error: "Не удалось получить ответ от языковой модели. Попробуйте ещё раз позже.",
          code: "ASSISTANT_LLM_ERROR",
        }),
        { status: 502 }
      )
    }
    if (!upstream.ok) {
      return NextResponse.json(
        apiErrorSchema.parse({
          error: "Сервис ассистента недоступен",
          code: "ASSISTANT_UNAVAILABLE",
        }),
        { status: 503 }
      )
    }

    return NextResponse.json(assistantAnswerSchema.parse(await upstream.json()))
  } catch (error) {
    return assistantErrorResponse(error)
  }
}
