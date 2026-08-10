import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { addComment, listComments } from "@/lib/repositories/tickets.repository"
import { apiErrorSchema, ticketCommentCreateSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

const idSchema = z.string().uuid()

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный идентификатор заявки", code: "INVALID_ID" }),
        { status: 400 }
      )
    }
    const items = await listComments(parsedId.data, auth.userId, auth.role)
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось загрузить комментарии"
    const status =
      known.status ?? (message.includes("не найдена") ? 404 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить комментарии" : (known.message ?? message),
        code: status === 404 ? "NOT_FOUND" : status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный идентификатор заявки", code: "INVALID_ID" }),
        { status: 400 }
      )
    }
    const body = await request.json()
    const parsed = ticketCommentCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный комментарий", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const created = await addComment(parsedId.data, parsed.data.body, auth.userId, auth.role)
    await writeAuditLog({
      userId: auth.userId,
      action: "user:tickets:comment",
      resourceType: "tickets",
      resourceId: parsedId.data,
      statusCode: 201,
    })
    return NextResponse.json({ item: created }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось добавить комментарий"
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
