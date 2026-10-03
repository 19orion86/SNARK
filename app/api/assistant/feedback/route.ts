import { NextRequest, NextResponse } from "next/server"
import { assistantRequest } from "@/lib/assistant/client"
import { assistantErrorResponse, invalidPayloadResponse } from "@/lib/assistant/respond"
import { requireAuth } from "@/lib/auth/request-auth"
import { assistantFeedbackSchema } from "@/lib/validators/assistant"
import { apiErrorSchema } from "@/lib/validators/portal"

export const dynamic = "force-dynamic"

/** Оценка ответа 👍/👎. Оценить можно только собственное обращение. */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const parsed = assistantFeedbackSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return invalidPayloadResponse()

    const upstream = await assistantRequest(`/queries/${parsed.data.queryId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ user_id: auth.userId, value: parsed.data.value }),
    })
    if (upstream.status === 404) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Обращение не найдено", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }
    if (!upstream.ok) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Не удалось сохранить оценку", code: "ASSISTANT_UNAVAILABLE" }),
        { status: 503 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return assistantErrorResponse(error)
  }
}
