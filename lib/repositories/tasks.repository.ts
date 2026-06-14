import "server-only"
import { and, count, desc, eq, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "@/lib/db/client"
import { departments, tasks, users } from "@/lib/db/schema"
import type {
  PortalTask,
  TaskCreatePayload,
  TaskPriority,
  TasksListResponse,
  TasksQuery,
  TaskStatus,
  TaskUpdatePayload,
} from "@/types/portal"

const assignee = alias(users, "task_assignee")
const creator = alias(users, "task_creator")
const dept = alias(departments, "task_department")

type TaskRow = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  assigneeId: string | null
  assigneeFirstName: string | null
  assigneeLastName: string | null
  creatorId: string
  creatorFirstName: string
  creatorLastName: string
  departmentId: string | null
  departmentName: string | null
  dueDate: string | null
  protocolActionItemId: number | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function mapTaskRow(row: TaskRow): PortalTask {
  const assigneeName =
    row.assigneeFirstName || row.assigneeLastName
      ? `${row.assigneeLastName ?? ""} ${row.assigneeFirstName ?? ""}`.trim()
      : null
  const creatorName = `${row.creatorLastName} ${row.creatorFirstName}`.trim()
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    assigneeId: row.assigneeId,
    assigneeName,
    creatorId: row.creatorId,
    creatorName,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    dueDate: row.dueDate,
    protocolActionItemId: row.protocolActionItemId,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function selectTaskRow(id: string): Promise<TaskRow | null> {
  const [row] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      assigneeFirstName: assignee.firstName,
      assigneeLastName: assignee.lastName,
      creatorId: tasks.creatorId,
      creatorFirstName: creator.firstName,
      creatorLastName: creator.lastName,
      departmentId: tasks.departmentId,
      departmentName: dept.name,
      dueDate: tasks.dueDate,
      protocolActionItemId: tasks.protocolActionItemId,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .innerJoin(creator, eq(creator.id, tasks.creatorId))
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .leftJoin(dept, eq(dept.id, tasks.departmentId))
    .where(eq(tasks.id, id))
    .limit(1)
  return row ?? null
}

const mockTasks: PortalTask[] = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    title: "Подготовить отчёт по проекту",
    description: "Собрать метрики за квартал",
    status: "in_progress",
    priority: "high",
    assigneeId: null,
    assigneeName: null,
    creatorId: "00000000-0000-0000-0000-000000000001",
    creatorName: "Администратор",
    departmentId: null,
    departmentName: null,
    dueDate: "2026-06-20",
    protocolActionItemId: null,
    completedAt: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-10T12:00:00.000Z",
  },
]

function useMockDb(): boolean {
  return process.env.USE_MOCK_DB !== "false"
}

export async function listTasks(
  userId: string,
  query?: TasksQuery,
  role?: string
): Promise<TasksListResponse> {
  if (useMockDb()) {
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    let filtered = mockTasks.filter(
      (task) =>
        role === "admin" ||
        role === "hr_manager" ||
        task.assigneeId === userId ||
        task.creatorId === userId
    )
    if (query?.status && query.status !== "all") {
      filtered = filtered.filter((task) => task.status === query.status)
    }
    const start = (page - 1) * limit
    return {
      items: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
    }
  }

  const page = query?.page ?? 1
  const limit = query?.limit ?? 20
  const offset = (page - 1) * limit

  const conditions = []
  if (role !== "admin" && role !== "hr_manager") {
    conditions.push(sql`(${tasks.assigneeId} = ${userId} OR ${tasks.creatorId} = ${userId})`)
  }
  if (query?.status && query.status !== "all") {
    conditions.push(eq(tasks.status, query.status))
  }
  if (query?.assigneeId) {
    conditions.push(eq(tasks.assigneeId, query.assigneeId))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [totalRow] = await db.select({ value: count() }).from(tasks).where(where)
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      assigneeFirstName: assignee.firstName,
      assigneeLastName: assignee.lastName,
      creatorId: tasks.creatorId,
      creatorFirstName: creator.firstName,
      creatorLastName: creator.lastName,
      departmentId: tasks.departmentId,
      departmentName: dept.name,
      dueDate: tasks.dueDate,
      protocolActionItemId: tasks.protocolActionItemId,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .innerJoin(creator, eq(creator.id, tasks.creatorId))
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .leftJoin(dept, eq(dept.id, tasks.departmentId))
    .where(where)
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)
    .offset(offset)

  return {
    items: rows.map(mapTaskRow),
    total: Number(totalRow?.value ?? 0),
    page,
    limit,
  }
}

export async function getTaskById(
  id: string,
  userId: string,
  role?: string
): Promise<PortalTask | null> {
  if (useMockDb()) {
    const task = mockTasks.find((item) => item.id === id)
    if (!task) return null
    if (
      role !== "admin" &&
      role !== "hr_manager" &&
      task.assigneeId !== userId &&
      task.creatorId !== userId
    ) {
      return null
    }
    return task
  }

  const row = await selectTaskRow(id)
  if (!row) return null
  if (
    role !== "admin" &&
    role !== "hr_manager" &&
    row.assigneeId !== userId &&
    row.creatorId !== userId
  ) {
    return null
  }
  return mapTaskRow(row)
}

export async function createTask(
  payload: TaskCreatePayload & { creatorId: string }
): Promise<PortalTask> {
  if (useMockDb()) {
    const task: PortalTask = {
      id: crypto.randomUUID(),
      title: payload.title,
      description: payload.description ?? null,
      status: "new",
      priority: payload.priority ?? "medium",
      assigneeId: payload.assigneeId ?? null,
      assigneeName: null,
      creatorId: payload.creatorId,
      creatorName: "Вы",
      departmentId: payload.departmentId ?? null,
      departmentName: null,
      dueDate: payload.dueDate ?? null,
      protocolActionItemId: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockTasks.unshift(task)
    return task
  }

  const [created] = await db
    .insert(tasks)
    .values({
      title: payload.title,
      description: payload.description ?? null,
      priority: payload.priority ?? "medium",
      assigneeId: payload.assigneeId ?? null,
      creatorId: payload.creatorId,
      departmentId: payload.departmentId ?? null,
      dueDate: payload.dueDate ?? null,
      status: "new",
    })
    .returning({ id: tasks.id })

  const row = await selectTaskRow(created.id)
  if (!row) throw new Error("Не удалось создать задачу")
  return mapTaskRow(row)
}

export async function updateTask(
  id: string,
  payload: TaskUpdatePayload,
  userId: string,
  role?: string
): Promise<PortalTask> {
  const existing = await getTaskById(id, userId, role)
  if (!existing) throw new Error("Задача не найдена")

  if (useMockDb()) {
    const index = mockTasks.findIndex((item) => item.id === id)
    if (index < 0) throw new Error("Задача не найдена")
    const next: PortalTask = {
      ...mockTasks[index],
      ...payload,
      title: payload.title ?? mockTasks[index].title,
      status: payload.status ?? mockTasks[index].status,
      priority: payload.priority ?? mockTasks[index].priority,
      updatedAt: new Date().toISOString(),
      completedAt:
        payload.status === "done"
          ? new Date().toISOString()
          : payload.status !== undefined
            ? null
            : mockTasks[index].completedAt,
    }
    mockTasks[index] = next
    return next
  }

  const updateSet: Record<string, unknown> = { updatedAt: new Date() }
  if (payload.title !== undefined) updateSet.title = payload.title
  if (payload.description !== undefined) updateSet.description = payload.description
  if (payload.status !== undefined) {
    updateSet.status = payload.status
    updateSet.completedAt = payload.status === "done" ? new Date() : null
  }
  if (payload.priority !== undefined) updateSet.priority = payload.priority
  if (payload.assigneeId !== undefined) updateSet.assigneeId = payload.assigneeId
  if (payload.departmentId !== undefined) updateSet.departmentId = payload.departmentId
  if (payload.dueDate !== undefined) updateSet.dueDate = payload.dueDate

  await db.update(tasks).set(updateSet).where(eq(tasks.id, id))
  const row = await selectTaskRow(id)
  if (!row) throw new Error("Задача не найдена")
  return mapTaskRow(row)
}

export async function listMyDashboardTasks(userId: string): Promise<
  Array<{ title: string; deadline: string; priority: "high" | "medium" | "low" }>
> {
  const data = await listTasks(userId, { status: "all", limit: 5, page: 1 })
  return data.items
    .filter((task) => task.status !== "done" && task.status !== "cancelled")
    .map((task) => ({
      title: task.title,
      deadline: task.dueDate ?? "—",
      priority: task.priority === "critical" ? "high" : task.priority,
    }))
}
