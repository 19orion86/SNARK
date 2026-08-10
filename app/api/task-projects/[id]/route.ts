import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { getProject, listTasksByProject } from "@/lib/repositories/task-projects.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

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
        apiErrorSchema.parse({ error: "Некорректный идентификатор проекта", code: "INVALID_ID" }),
        { status: 400 }
      )
    }
    const project = await getProject(parsedId.data)
    if (!project) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Проект не найден", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }
    const tasks = await listTasksByProject(parsedId.data, auth.userId, auth.role)
    return NextResponse.json({ item: project, tasks })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить проект" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
