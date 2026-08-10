import { redirect } from "next/navigation"
import { TasksPageContent } from "@/components/tasks/tasks-page-content"
import { getServerSession } from "@/lib/auth/server-session"
import { loadContactsData } from "@/lib/portal-data/loaders"
import { listTasks } from "@/lib/repositories/tasks.repository"
import type { TaskPriority, TaskStatus, TasksQuery } from "@/types/portal"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Задачи",
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function TasksPage({ searchParams }: PageProps) {
  const session = await getServerSession()
  if (!session) {
    redirect("/login")
  }

  const sp = await searchParams
  const scope = first(sp.scope) as TasksQuery["scope"] | undefined
  const status = first(sp.status) as TaskStatus | "all" | undefined
  const priority = first(sp.priority) as TaskPriority | undefined
  const projectId = first(sp.projectId)
  const q = first(sp.q)
  const overdue = first(sp.overdue) === "true"

  const query: TasksQuery = {
    page: 1,
    limit: 50,
    scope: scope && scope !== "all" ? scope : overdue ? "overdue" : undefined,
    status: status && status !== "all" ? status : undefined,
    priority,
    projectId: projectId || undefined,
    q: q || undefined,
    overdue: overdue || undefined,
  }

  const [data, contacts] = await Promise.all([
    listTasks(session.userId, query, session.role),
    loadContactsData({ limit: 300 }),
  ])

  return (
    <TasksPageContent
      initial={data}
      employees={contacts.employees}
      currentUserId={session.userId}
      initialFilters={{
        scope: scope ?? (overdue ? "overdue" : "all"),
        status: status ?? "all",
        priority: priority ?? "all",
        q: q ?? "",
        projectId: projectId ?? "all",
      }}
    />
  )
}
