import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requestReindex } from "@/lib/assistant/client"
import { assistantErrorResponse, invalidPayloadResponse } from "@/lib/assistant/respond"
import { requireRole } from "@/lib/auth/request-auth"
import { documentExists } from "@/lib/repositories/assistant.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

const idSchema = z.string().uuid()

/** Кнопка «Переиндексировать» в админке документов. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) return invalidPayloadResponse("Некорректный идентификатор")

    if (!(await documentExists(parsedId.data))) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Документ не найден", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }

    const queued = await requestReindex("document", parsedId.data)
    if (!queued) {
      return NextResponse.json(
        apiErrorSchema.parse({
          error: "Сервис ассистента недоступен, индексация не запущена",
          code: "ASSISTANT_UNAVAILABLE",
        }),
        { status: 503 }
      )
    }
    return NextResponse.json({ id: parsedId.data, queued: true }, { status: 202 })
  } catch (error) {
    return assistantErrorResponse(error)
  }
}
