import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import { listNotifications } from "@/lib/repositories/notifications.repository"
import { listTasks } from "@/lib/repositories/tasks.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const repo = getPortalRepositoryServer()

    const [dashboard, notifications, overdueTasks] = await Promise.all([
      repo.getDashboardData(auth.userId),
      listNotifications(auth.userId, 20),
      listTasks(auth.userId, { scope: "overdue", page: 1, limit: 20 }, auth.role),
    ])

    return NextResponse.json({
      welcomeName: dashboard.welcomeName,
      birthdays: dashboard.birthdays,
      recentNews: dashboard.recentNews,
      newEmployees: dashboard.newEmployees,
      myTasks: dashboard.myTasks,
      quickActions: dashboard.quickActions,
      serviceCards: dashboard.serviceCards,
      overdueTasks: {
        items: overdueTasks.items,
        total: overdueTasks.total,
      },
      notifications: {
        items: notifications.items,
        unreadCount: notifications.unreadCount,
      },
    })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error:
          status === 500 ? "Не удалось загрузить дашборд" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
