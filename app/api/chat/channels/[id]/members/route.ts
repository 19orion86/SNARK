import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import {
  addChannelMembers,
  listChannelMembers,
  removeChannelMembers,
} from "@/lib/repositories/chat.repository"
import {
  apiErrorSchema,
  chatChannelMembersResponseSchema,
  chatChannelSchema,
} from "@/lib/validators/portal"
import { z } from "zod"

const membersSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

function errorResponse(error: unknown, fallback: string) {
  const known = error as Partial<AuthError>
  const message = error instanceof Error ? error.message : fallback
  const status =
    known.status ?? (message.includes("доступ") ? 403 : message.includes("найден") ? 404 : 500)
  return NextResponse.json(
    apiErrorSchema.parse({
      error: status === 500 ? message : (known.message ?? message),
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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const items = await listChannelMembers(id, auth.userId)
    return NextResponse.json(chatChannelMembersResponseSchema.parse({ items, channelId: id }))
  } catch (error) {
    return errorResponse(error, "Не удалось загрузить участников")
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const body = await request.json()
    const parsed = membersSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Укажите участников", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const channel = await addChannelMembers(id, auth.userId, parsed.data.memberIds)
    return NextResponse.json({ item: chatChannelSchema.parse(channel) })
  } catch (error) {
    return errorResponse(error, "Не удалось добавить участников")
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const body = await request.json()
    const parsed = membersSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Укажите участников", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const channel = await removeChannelMembers(id, auth.userId, parsed.data.memberIds)
    return NextResponse.json({ item: chatChannelSchema.parse(channel) })
  } catch (error) {
    return errorResponse(error, "Не удалось удалить участников")
  }
}
