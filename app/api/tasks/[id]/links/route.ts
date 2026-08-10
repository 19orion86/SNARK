import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { addTaskLink, listTaskLinks, removeTaskLink } from "@/lib/repositories/task-links.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

const linkPayloadSchema = z.object({
  entityType: z.enum([
    "protocol",
    "protocol_action_item",
    "ticket",
    "employee",
    "department",
    "chat_message",
    "deal",
  ]),
  entityId: z.string().min(1).max(100),
})

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const items = await listTaskLinks(id, auth.userId, auth.role)
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Ошибка"
    const status = known.status ?? (message.includes("не найдена") ? 404 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить связи" : (known.message ?? message),
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
    const body = await request.json()
    const parsed = linkPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные связи", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const items = await addTaskLink(
      id,
      parsed.data.entityType,
      parsed.data.entityId,
      auth.userId,
      auth.role
    )
    await writeAuditLog({
      userId: auth.userId,
      action: "user:tasks:link:add",
      resourceType: "task_links",
      resourceId: id,
      statusCode: 200,
    })
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Ошибка"
    const status =
      known.status ??
      (message.includes("не найдена") ? 404 : message.includes("прав") ? 403 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось добавить связь" : (known.message ?? message),
        code:
          status === 404
            ? "NOT_FOUND"
            : status === 403
              ? "FORBIDDEN"
              : status === 500
                ? "INTERNAL_ERROR"
                : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const linkId = request.nextUrl.searchParams.get("linkId")
    if (!linkId) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "linkId обязателен", code: "INVALID_QUERY" }),
        { status: 400 }
      )
    }
    const items = await removeTaskLink(id, linkId, auth.userId, auth.role)
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Ошибка"
    const status = known.status ?? (message.includes("не найдена") ? 404 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось удалить связь" : (known.message ?? message),
        code: status === 404 ? "NOT_FOUND" : status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
