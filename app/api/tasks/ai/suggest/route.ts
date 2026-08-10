import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { suggestTask } from "@/lib/ai/task-copilot"
import { listMessages } from "@/lib/repositories/chat.repository"
import { getTaskDetail } from "@/lib/repositories/tasks.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

const suggestSchema = z.object({
  mode: z.enum(["formulate", "checklist", "due_hint", "chat_summary"]),
  title: z.string().optional(),
  description: z.string().optional(),
  taskId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const body = await request.json()
    const parsed = suggestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный запрос CoPilot", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    let messages: Array<{ authorName?: string; body: string }> | undefined
    if (parsed.data.mode === "chat_summary" && parsed.data.taskId) {
      const task = await getTaskDetail(parsed.data.taskId, auth.userId, auth.role)
      if (!task) {
        return NextResponse.json(
          apiErrorSchema.parse({ error: "Задача не найдена", code: "NOT_FOUND" }),
          { status: 404 }
        )
      }
      if (task.chatChannelId) {
        const history = await listMessages(task.chatChannelId, auth.userId, { limit: 50 })
        messages = history.items.map((m) => ({
          authorName: m.authorName,
          body: m.body,
        }))
      }
    }

    const result = await suggestTask({
      mode: parsed.data.mode,
      title: parsed.data.title,
      description: parsed.data.description,
      messages,
    })

    return NextResponse.json({ item: result })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "CoPilot временно недоступен" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
