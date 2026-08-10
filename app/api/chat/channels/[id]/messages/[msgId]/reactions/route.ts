import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { toggleReaction } from "@/lib/repositories/chat-extras.repository"
import { getMessageById } from "@/lib/repositories/chat.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(32),
})

interface RouteContext {
  params: Promise<{ id: string; msgId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id, msgId } = await context.params
    const body = await request.json()
    const parsed = reactionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Укажите emoji", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const message = await getMessageById(msgId)
    if (!message || message.channelId !== id) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Сообщение не найдено", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }

    const result = await toggleReaction(msgId, auth.userId, parsed.data.emoji)
    return NextResponse.json({ item: result })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось поставить реакцию"
    const status =
      known.status ??
      (message.includes("доступ") ? 403 : message.includes("найдено") ? 404 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: message,
        code: status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
      }),
      { status }
    )
  }
}
