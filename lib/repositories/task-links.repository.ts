import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { taskLinks } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { getTaskDetail } from "@/lib/repositories/tasks.repository"

export type TaskLinkEntityType =
  | "protocol"
  | "protocol_action_item"
  | "ticket"
  | "employee"
  | "department"
  | "chat_message"
  | "deal"

export interface TaskLink {
  id: string
  taskId: string
  entityType: string
  entityId: string
  createdAt: string
}

const mockLinks: TaskLink[] = []

export async function listTaskLinks(
  taskId: string,
  userId: string,
  role?: string
): Promise<TaskLink[]> {
  const task = await getTaskDetail(taskId, userId, role)
  if (!task) throw new Error("Задача не найдена")

  if (isMockDb()) {
    return mockLinks.filter((l) => l.taskId === taskId)
  }

  const rows = await db.select().from(taskLinks).where(eq(taskLinks.taskId, taskId))
  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function addTaskLink(
  taskId: string,
  entityType: TaskLinkEntityType | string,
  entityId: string,
  userId: string,
  role?: string
): Promise<TaskLink[]> {
  const task = await getTaskDetail(taskId, userId, role)
  if (!task) throw new Error("Задача не найдена")
  const canEdit =
    role === "admin" ||
    role === "hr_manager" ||
    task.creatorId === userId ||
    task.assigneeId === userId
  if (!canEdit) throw new Error("Нет прав на изменение связей")

  if (isMockDb()) {
    if (!mockLinks.some((l) => l.taskId === taskId && l.entityType === entityType && l.entityId === entityId)) {
      mockLinks.push({
        id: crypto.randomUUID(),
        taskId,
        entityType,
        entityId,
        createdAt: new Date().toISOString(),
      })
    }
    return mockLinks.filter((l) => l.taskId === taskId)
  }

  await db
    .insert(taskLinks)
    .values({ taskId, entityType, entityId })
    .onConflictDoNothing({
      target: [taskLinks.taskId, taskLinks.entityType, taskLinks.entityId],
    })

  return listTaskLinks(taskId, userId, role)
}

export async function removeTaskLink(
  taskId: string,
  linkId: string,
  userId: string,
  role?: string
): Promise<TaskLink[]> {
  const task = await getTaskDetail(taskId, userId, role)
  if (!task) throw new Error("Задача не найдена")

  if (isMockDb()) {
    const idx = mockLinks.findIndex((l) => l.id === linkId && l.taskId === taskId)
    if (idx >= 0) mockLinks.splice(idx, 1)
    return mockLinks.filter((l) => l.taskId === taskId)
  }

  await db.delete(taskLinks).where(and(eq(taskLinks.id, linkId), eq(taskLinks.taskId, taskId)))
  return listTaskLinks(taskId, userId, role)
}
