import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { addChannelToFolder } from "@/lib/repositories/chat-extras.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

const addSchema = z.object({
  channelId: z.string().uuid(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const body = await request.json()
    const parsed = addSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Укажите channelId", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const item = await addChannelToFolder(id, auth.userId, parsed.data.channelId)
    return NextResponse.json({ item })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось добавить канал в папку"
    const status =
      known.status ??
      (message.includes("доступ") ? 403 : message.includes("найдена") ? 404 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: message,
        code: status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
      }),
      { status }
    )
  }
}
