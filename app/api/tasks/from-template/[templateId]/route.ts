import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { db } from "@/lib/db/client"
import { taskChecklistItems, taskTemplates } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { createTask, getTaskDetail } from "@/lib/repositories/tasks.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ templateId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { templateId } = await context.params

    if (isMockDb()) {
      const task = await createTask({
        title: "Задача из шаблона",
        creatorId: auth.userId,
      })
      return NextResponse.json({ item: task }, { status: 201 })
    }

    const [template] = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, templateId))
      .limit(1)
    if (!template) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Шаблон не найден", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }

    const task = await createTask({
      title: template.title,
      description: template.description,
      priority: (template.priority as "low" | "medium" | "high" | "critical") ?? "medium",
      creatorId: auth.userId,
    })

    const checklist = (template.checklistJson as string[] | null) ?? []
    if (checklist.length > 0) {
      await db.insert(taskChecklistItems).values(
        checklist.map((title, index) => ({
          taskId: task.id,
          title,
          sortOrder: index,
        }))
      )
    }

    const detail = await getTaskDetail(task.id, auth.userId, auth.role)
    return NextResponse.json({ item: detail ?? task }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось создать задачу из шаблона" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
