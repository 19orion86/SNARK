import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { listChannelMessages, sendMessage } from "@/lib/repositories/chat.repository"
import {
  apiErrorSchema,
  chatMessageCreateSchema,
  chatMessagesListResponseSchema,
} from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const data = await listChannelMessages(id, auth.userId)
    return NextResponse.json(chatMessagesListResponseSchema.parse(data))
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось загрузить сообщения"
    const status = known.status ?? (message.includes("доступа") ? 403 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? message : (known.message ?? message),
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
    const body = await request.json()
    const parsed = chatMessageCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректное сообщение", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const created = await sendMessage(id, auth.userId, parsed.data.body)
    await writeAuditLog({
      userId: auth.userId,
      action: "user:chat:send-message",
      resourceType: "chat_messages",
      resourceId: created.id,
      statusCode: 201,
    })
    return NextResponse.json({ item: created }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось отправить сообщение"
    const status = known.status ?? (message.includes("доступа") ? 403 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? message : (known.message ?? message),
        code: status === 403 ? "FORBIDDEN" : status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
