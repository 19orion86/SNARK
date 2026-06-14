import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { listTasks, createTask } from "@/lib/repositories/tasks.repository"
import {
  apiErrorSchema,
  taskCreateSchema,
  taskDetailResponseSchema,
  tasksListQuerySchema,
  tasksListResponseSchema,
} from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = tasksListQuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные параметры задач", code: "INVALID_QUERY" }),
        { status: 400 }
      )
    }
    const data = await listTasks(auth.userId, parsed.data, auth.role)
    return NextResponse.json(tasksListResponseSchema.parse(data))
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить задачи" : (known.message ?? "Ошибка доступа"),
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
    const parsed = taskCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные задачи", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const created = await createTask({ ...parsed.data, creatorId: auth.userId })
    await writeAuditLog({
      userId: auth.userId,
      action: "user:tasks:create",
      resourceType: "tasks",
      resourceId: created.id,
      statusCode: 201,
    })
    return NextResponse.json(taskDetailResponseSchema.parse({ item: created }), { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось создать задачу" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
