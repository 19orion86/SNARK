import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { findOrCreateDirectChannel } from "@/lib/repositories/chat.repository"
import { apiErrorSchema } from "@/lib/validators/portal"
import { z } from "zod"

const directChatSchema = z.object({
  peerId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const body = await request.json()
    const parsed = directChatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Укажите собеседника", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const channel = await findOrCreateDirectChannel(auth.userId, parsed.data.peerId)
    return NextResponse.json({ item: channel })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось открыть диалог" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
