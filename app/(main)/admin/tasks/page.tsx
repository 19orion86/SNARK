import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getServerSession } from "@/lib/auth/server-session"
import { listTasks } from "@/lib/repositories/tasks.repository"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Задачи — Админ-панель",
}

export default async function AdminTasksPage() {
  const session = await getServerSession()
  if (!session) redirect("/login")
  if (session.role !== "admin" && session.role !== "hr_manager") redirect("/admin")

  const [all, overdue, done] = await Promise.all([
    listTasks(session.userId, { page: 1, limit: 1 }, "admin"),
    listTasks(session.userId, { scope: "overdue", page: 1, limit: 1 }, "admin"),
    listTasks(session.userId, { status: "done", page: 1, limit: 1 }, "admin"),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold text-card-foreground">Задачи</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Сводная статистика по задачам портала.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">Всего</p>
            <p className="mt-1 text-2xl font-semibold">{all.total}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">Просрочено</p>
            <p className="mt-1 text-2xl font-semibold">{overdue.total}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">Завершено</p>
            <p className="mt-1 text-2xl font-semibold">{done.total}</p>
          </div>
        </div>
        <div className="mt-6">
          <Link href="/tasks">
            <Button className="bg-[#16223b] hover:bg-[#16223b]/90">Открыть задачи</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
