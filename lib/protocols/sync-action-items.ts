import "server-only"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { taskLinks, tasks, users } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { matchAssigneeFuzzy } from "@/lib/protocols/match-assignee"
import { createNotification } from "@/lib/repositories/notifications.repository"
import { createTask } from "@/lib/repositories/tasks.repository"
import type { PortalTask, TaskPriority } from "@/types/portal"

export interface ProtocolActionItemSyncInput {
  id: number
  text: string
  assignee?: string | null
  deadline?: string | null
  priority?: string | null
}

export interface ProtocolActionItemsSyncPayload {
  protocolId: number
  protocolTitle?: string | null
  meetingDate?: string | null
  actionItems: ProtocolActionItemSyncInput[]
}

export interface ProtocolActionItemSyncResult {
  actionItemId: number
  taskId: string | null
  created: boolean
  skipped: boolean
  requiresAssignment: boolean
  assigneeId: string | null
  error?: string
}

const mockProtocolLinks = new Map<number, string>()

function mapPriority(value: string | null | undefined): TaskPriority {
  if (value === "high" || value === "critical" || value === "low" || value === "medium") {
    return value
  }
  return "medium"
}

async function listActiveUsers(): Promise<Array<{ id: string; firstName: string; lastName: string }>> {
  if (isMockDb()) {
    return [
      { id: "00000000-0000-0000-0000-000000000001", firstName: "Админ", lastName: "Тест" },
      { id: "00000000-0000-0000-0000-000000000002", firstName: "Иван", lastName: "Иванов" },
    ]
  }
  return db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.isActive, true))
}

async function resolveCreatorUserId(): Promise<string> {
  const fromEnv = process.env.PROTOCOL_TASK_CREATOR_USER_ID?.trim()
  if (fromEnv) return fromEnv

  if (isMockDb()) {
    return "00000000-0000-0000-0000-000000000001"
  }

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)))
    .limit(1)

  if (!admin) {
    throw new Error("Не найден admin для создания задач из протокола")
  }
  return admin.id
}

async function findExistingTaskId(actionItemId: number): Promise<string | null> {
  if (isMockDb()) {
    return mockProtocolLinks.get(actionItemId) ?? null
  }

  const [byColumn] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.protocolActionItemId, actionItemId))
    .limit(1)
  if (byColumn) return byColumn.id

  const [byLink] = await db
    .select({ taskId: taskLinks.taskId })
    .from(taskLinks)
    .where(
      and(
        eq(taskLinks.entityType, "protocol_action_item"),
        eq(taskLinks.entityId, String(actionItemId))
      )
    )
    .limit(1)
  return byLink?.taskId ?? null
}

async function linkProtocolActionItem(taskId: string, actionItemId: number): Promise<void> {
  if (isMockDb()) {
    mockProtocolLinks.set(actionItemId, taskId)
    return
  }
  await db
    .insert(taskLinks)
    .values({
      taskId,
      entityType: "protocol_action_item",
      entityId: String(actionItemId),
    })
    .onConflictDoNothing()
}

function buildDescription(input: {
  text: string
  protocolId: number
  protocolTitle?: string | null
  assigneeRaw?: string | null
  requiresAssignment: boolean
}): string {
  const lines = [
    input.text,
    "",
    `Источник: протокол #${input.protocolId}${input.protocolTitle ? ` «${input.protocolTitle}»` : ""}`,
  ]
  if (input.requiresAssignment) {
    lines.push("Требует назначения исполнителя.")
    if (input.assigneeRaw?.trim()) {
      lines.push(`ФИО из протокола: ${input.assigneeRaw.trim()}`)
    }
  }
  return lines.join("\n")
}

export async function syncProtocolActionItems(
  payload: ProtocolActionItemsSyncPayload
): Promise<{
  protocolId: number
  results: ProtocolActionItemSyncResult[]
  createdCount: number
  skippedCount: number
}> {
  const creatorId = await resolveCreatorUserId()
  const directory = await listActiveUsers()
  const results: ProtocolActionItemSyncResult[] = []
  let createdCount = 0
  let skippedCount = 0

  for (const item of payload.actionItems) {
    try {
      const existingId = await findExistingTaskId(item.id)
      if (existingId) {
        skippedCount++
        results.push({
          actionItemId: item.id,
          taskId: existingId,
          created: false,
          skipped: true,
          requiresAssignment: false,
          assigneeId: null,
        })
        continue
      }

      const assigneeId = matchAssigneeFuzzy(item.assignee, directory, 0.9)
      const requiresAssignment = !assigneeId
      const title = item.text.trim().slice(0, 500) || `Поручение из протокола #${payload.protocolId}`
      const description = buildDescription({
        text: item.text.trim(),
        protocolId: payload.protocolId,
        protocolTitle: payload.protocolTitle,
        assigneeRaw: item.assignee,
        requiresAssignment,
      })

      const task = await createTaskFromProtocol({
        title,
        description,
        assigneeId,
        dueDate: item.deadline ?? payload.meetingDate ?? null,
        priority: mapPriority(item.priority),
        protocolActionItemId: item.id,
        creatorId,
      })

      await linkProtocolActionItem(task.id, item.id)

      if (assigneeId) {
        await createNotification({
          userId: assigneeId,
          type: "protocol_task",
          title: `Вам поручение из протокола ${payload.protocolId}${
            payload.protocolTitle ? ` «${payload.protocolTitle}»` : ""
          }`,
          entityType: "task",
          entityId: task.id,
        })
      }

      createdCount++
      results.push({
        actionItemId: item.id,
        taskId: task.id,
        created: true,
        skipped: false,
        requiresAssignment,
        assigneeId,
      })
    } catch (error) {
      results.push({
        actionItemId: item.id,
        taskId: null,
        created: false,
        skipped: false,
        requiresAssignment: true,
        assigneeId: null,
        error: error instanceof Error ? error.message : "Ошибка синхронизации",
      })
    }
  }

  return {
    protocolId: payload.protocolId,
    results,
    createdCount,
    skippedCount,
  }
}

async function createTaskFromProtocol(input: {
  title: string
  description: string
  assigneeId: string | null
  dueDate: string | null
  priority: TaskPriority
  protocolActionItemId: number
  creatorId: string
}): Promise<PortalTask> {
  // createTask расширен protocolActionItemId ниже
  return createTask({
    title: input.title,
    description: input.description,
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    priority: input.priority,
    protocolActionItemId: input.protocolActionItemId,
    creatorId: input.creatorId,
  })
}

/** Сообщить сервису протоколов, что поручение выполнено (односторонняя sync). */
export async function markProtocolActionItemDone(actionItemId: number): Promise<void> {
  const base = process.env.PROTOCOLS_API_URL?.replace(/\/$/, "")
  if (!base) return

  const token = process.env.INTERNAL_TOKEN?.trim()
  const url = `${base}/api/v1/protocols/action-items/${actionItemId}/status?new_status=done`
  const headers: Record<string, string> = {}
  if (token) headers["X-Internal-Token"] = token

  try {
    await fetch(url, { method: "PATCH", headers, cache: "no-store" })
  } catch {
    // best-effort: портал — источник правды даже если Python временно недоступен
  }
}

/** Только для тестов mock. */
export function resetMockProtocolLinksForTests(): void {
  mockProtocolLinks.clear()
}

export async function countProtocolLinkedTasks(): Promise<number> {
  if (isMockDb()) return mockProtocolLinks.size
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(tasks)
    .where(sql`${tasks.protocolActionItemId} is not null`)
  return Number(row?.value ?? 0)
}
