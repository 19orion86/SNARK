import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getTaskById, updateTask } from "@/lib/repositories/tasks.repository"
import {
  apiErrorSchema,
  taskDetailResponseSchema,
  taskUpdateSchema,
} from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const item = await getTaskById(id, auth.userId, auth.role)
    return NextResponse.json(taskDetailResponseSchema.parse({ item }))
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить задачу" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const body = await request.json()
    const parsed = taskUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные задачи", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const updated = await updateTask(id, parsed.data, auth.userId, auth.role)
    await writeAuditLog({
      userId: auth.userId,
      action: "user:tasks:update",
      resourceType: "tasks",
      resourceId: updated.id,
      statusCode: 200,
    })
    return NextResponse.json(taskDetailResponseSchema.parse({ item: updated }))
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось обновить задачу"
    const status = known.status ?? (message.includes("не найдена") ? 404 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? message : (known.message ?? message),
        code: status === 404 ? "NOT_FOUND" : status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
