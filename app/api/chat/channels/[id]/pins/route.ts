import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { listPinnedMessages, pinMessage } from "@/lib/repositories/chat-pins.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

const pinSchema = z.object({
  messageId: z.string().uuid(),
})

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const items = await listPinnedMessages(id, auth.userId)
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось загрузить закрепления"
    const status = known.status ?? (message.includes("доступ") ? 403 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить закрепления" : (known.message ?? message),
        code: status === 403 ? "FORBIDDEN" : status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const parsed = pinSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Укажите messageId", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const item = await pinMessage(id, parsed.data.messageId, auth.userId)
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось закрепить"
    const status =
      known.status ??
      (message.includes("доступ") ? 403 : message.includes("не найден") ? 404 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось закрепить сообщение" : (known.message ?? message),
        code:
          status === 403
            ? "FORBIDDEN"
            : status === 404
              ? "NOT_FOUND"
              : status === 500
                ? "INTERNAL_ERROR"
                : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
