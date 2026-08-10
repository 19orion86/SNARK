import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { updateDealStage } from "@/lib/repositories/deals.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

const idSchema = z.string().uuid()
const patchSchema = z.object({
  stageId: z.string().uuid(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    requireAuth(request)
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный идентификатор сделки", code: "INVALID_ID" }),
        { status: 400 }
      )
    }
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const updated = await updateDealStage(parsedId.data, parsed.data.stageId)
    return NextResponse.json({ item: updated })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось обновить сделку"
    const status =
      known.status ?? (message.includes("не найдена") ? 404 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? message : (known.message ?? message),
        code: status === 404 ? "NOT_FOUND" : status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
