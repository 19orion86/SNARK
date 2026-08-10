import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { vote } from "@/lib/repositories/chat-polls.repository"
import { apiErrorSchema, chatPollSummarySchema, chatPollVoteSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ pollId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { pollId } = await context.params
    const body = await request.json()
    const parsed = chatPollVoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный голос", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const poll = await vote(pollId, parsed.data.optionId, auth.userId)
    await writeAuditLog({
      userId: auth.userId,
      action: "user:chat:poll:vote",
      resourceType: "chat_polls",
      resourceId: pollId,
      statusCode: 200,
    })
    return NextResponse.json({ item: chatPollSummarySchema.parse(poll) })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось проголосовать"
    const status =
      known.status ??
      (message.includes("доступ")
        ? 403
        : message.includes("не найден") || message.includes("не найдено")
          ? 404
          : message.includes("закрыт")
            ? 400
            : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось проголосовать" : (known.message ?? message),
        code:
          status === 403
            ? "FORBIDDEN"
            : status === 404
              ? "NOT_FOUND"
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
