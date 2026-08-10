import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { createChatFolder, listChatFolders } from "@/lib/repositories/chat-extras.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const items = await listChatFolders(auth.userId)
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить папки" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Укажите название папки", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const item = await createChatFolder(auth.userId, parsed.data.name)
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось создать папку"
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: message,
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
