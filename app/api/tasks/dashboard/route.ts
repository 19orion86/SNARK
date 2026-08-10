import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { listMyChannels } from "@/lib/repositories/chat.repository"
import { countOverdueTasks, listTasks } from "@/lib/repositories/tasks.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const today = todayDateOnly()

    const [mine, overdueCount, channelsResult] = await Promise.all([
      listTasks(auth.userId, { scope: "mine", page: 1, limit: 50 }, auth.role),
      countOverdueTasks(auth.userId, auth.role),
      listMyChannels(auth.userId),
    ])

    const channels = channelsResult.items
    const myTasksToday = mine.items.filter((t) => t.dueDate === today && t.status !== "done" && t.status !== "cancelled")
    const openMine = mine.items.filter((t) => t.status !== "done" && t.status !== "cancelled").slice(0, 10)
    const unreadChats = channels.filter((c) => (c.unreadCount ?? 0) > 0)

    return NextResponse.json({
      myTasksToday,
      openMine,
      overdueCount,
      unreadChatsCount: unreadChats.length,
      unreadChats: unreadChats.slice(0, 10).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        unreadCount: c.unreadCount,
      })),
    })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить дашборд задач" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
