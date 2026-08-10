import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import {
  createProject,
  listProjects,
} from "@/lib/repositories/task-projects.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  color: z.string().trim().max(32).optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    const items = await listProjects()
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить проекты" : (known.message ?? "Ошибка доступа"),
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
        apiErrorSchema.parse({ error: "Некорректные данные проекта", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const created = await createProject({ ...parsed.data, ownerId: auth.userId })
    await writeAuditLog({
      userId: auth.userId,
      action: "user:task-projects:create",
      resourceType: "task_projects",
      resourceId: created.id,
      statusCode: 201,
    })
    return NextResponse.json({ item: created }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось создать проект" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
