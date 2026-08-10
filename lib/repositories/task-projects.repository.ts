import "server-only"
import { asc, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { taskProjects, tasks } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { listTasks } from "@/lib/repositories/tasks.repository"
import type { TasksListResponse } from "@/types/portal"

export interface TaskProject {
  id: string
  name: string
  description: string | null
  ownerId: string | null
  departmentId: string | null
  status: string
  color: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskProjectCreatePayload {
  name: string
  description?: string | null
  ownerId?: string | null
  departmentId?: string | null
  color?: string | null
}

const mockProjects: TaskProject[] = []

function mapProject(row: {
  id: string
  name: string
  description: string | null
  ownerId: string | null
  departmentId: string | null
  status: string
  color: string | null
  createdAt: Date
  updatedAt: Date
}): TaskProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.ownerId,
    departmentId: row.departmentId,
    status: row.status,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listProjects(): Promise<TaskProject[]> {
  if (isMockDb()) {
    return [...mockProjects].sort((a, b) => a.name.localeCompare(b.name, "ru"))
  }

  const rows = await db.select().from(taskProjects).orderBy(asc(taskProjects.name))
  return rows.map(mapProject)
}

export async function createProject(
  payload: TaskProjectCreatePayload & { ownerId?: string | null }
): Promise<TaskProject> {
  if (isMockDb()) {
    const now = new Date().toISOString()
    const project: TaskProject = {
      id: crypto.randomUUID(),
      name: payload.name,
      description: payload.description ?? null,
      ownerId: payload.ownerId ?? null,
      departmentId: payload.departmentId ?? null,
      status: "active",
      color: payload.color ?? null,
      createdAt: now,
      updatedAt: now,
    }
    mockProjects.unshift(project)
    return project
  }

  const [created] = await db
    .insert(taskProjects)
    .values({
      name: payload.name,
      description: payload.description ?? null,
      ownerId: payload.ownerId ?? null,
      departmentId: payload.departmentId ?? null,
      color: payload.color ?? null,
      status: "active",
    })
    .returning()

  if (!created) throw new Error("Не удалось создать проект")
  return mapProject(created)
}

export async function getProject(id: string): Promise<TaskProject | null> {
  if (isMockDb()) {
    return mockProjects.find((p) => p.id === id) ?? null
  }

  const [row] = await db.select().from(taskProjects).where(eq(taskProjects.id, id)).limit(1)
  return row ? mapProject(row) : null
}

export async function listTasksByProject(
  projectId: string,
  userId: string,
  role?: string
): Promise<TasksListResponse> {
  return listTasks(userId, { projectId, page: 1, limit: 100 }, role)
}

/** Soft check: column exists in schema; used by tasks.repository when persisting. */
export async function projectExists(projectId: string): Promise<boolean> {
  if (isMockDb()) {
    return mockProjects.some((p) => p.id === projectId)
  }
  const [row] = await db
    .select({ id: taskProjects.id })
    .from(taskProjects)
    .where(eq(taskProjects.id, projectId))
    .limit(1)
  return Boolean(row)
}

export async function countTasksInProject(projectId: string): Promise<number> {
  if (isMockDb()) {
    return 0
  }
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.createdAt))
  return rows.length
}
