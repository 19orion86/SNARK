import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { createPoll } from "@/lib/repositories/chat-polls.repository"
import {
  apiErrorSchema,
  chatMessageSchema,
  chatPollCreateSchema,
  chatPollSummarySchema,
} from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const body = await request.json()
    const parsed = chatPollCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные опроса", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const result = await createPoll(id, auth.userId, parsed.data)
    await writeAuditLog({
      userId: auth.userId,
      action: "user:chat:poll:create",
      resourceType: "chat_polls",
      resourceId: result.poll.id,
      statusCode: 201,
    })

    return NextResponse.json(
      {
        item: chatMessageSchema.parse(result.message),
        poll: chatPollSummarySchema.parse(result.poll),
      },
      { status: 201 }
    )
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось создать опрос"
    const status =
      known.status ??
      (message.includes("доступ")
        ? 403
        : message.includes("минимум") || message.includes("Укажите")
          ? 400
          : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось создать опрос" : (known.message ?? message),
        code:
          status === 403
            ? "FORBIDDEN"
            : status === 400
              ? "INVALID_PAYLOAD"
              : status === 500
                ? "INTERNAL_ERROR"
                : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
