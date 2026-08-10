import "server-only"
import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { departments, users, vacationApprovals, vacations } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"

export type VacationApprovalStep = "manager" | "hr"
export type VacationApprovalStatus = "pending" | "approved" | "rejected"

export interface VacationApproval {
  id: string
  vacationId: string
  step: VacationApprovalStep
  approverId: string | null
  status: VacationApprovalStatus
  comment: string | null
  decidedAt: string | null
  createdAt: string
}

const mockApprovals: VacationApproval[] = []

function mapApproval(row: {
  id: string
  vacationId: string
  step: string
  approverId: string | null
  status: string
  comment: string | null
  decidedAt: Date | null
  createdAt: Date
}): VacationApproval {
  return {
    id: row.id,
    vacationId: row.vacationId,
    step: row.step as VacationApprovalStep,
    approverId: row.approverId,
    status: row.status as VacationApprovalStatus,
    comment: row.comment,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

async function findManagerId(userId: string): Promise<string | null> {
  if (isMockDb()) return null

  const [user] = await db
    .select({ departmentId: users.departmentId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user?.departmentId) return null

  const [dept] = await db
    .select({ headUserId: departments.headUserId })
    .from(departments)
    .where(eq(departments.id, user.departmentId))
    .limit(1)

  if (!dept?.headUserId || dept.headUserId === userId) return null
  return dept.headUserId
}

/** Create approval chain after vacation insert: manager (if found) + hr. */
export async function createApprovalChain(vacationId: string, userId: string): Promise<VacationApproval[]> {
  const managerId = await findManagerId(userId)
  const steps: { step: VacationApprovalStep; approverId: string | null }[] = []

  if (managerId) {
    steps.push({ step: "manager", approverId: managerId })
  } else {
    // Pragmatic fallback: both steps with null approver so admin/hr can approve any
    steps.push({ step: "manager", approverId: null })
  }
  steps.push({ step: "hr", approverId: null })

  if (isMockDb()) {
    const created = steps.map((s) => ({
      id: crypto.randomUUID(),
      vacationId,
      step: s.step,
      approverId: s.approverId,
      status: "pending" as const,
      comment: null,
      decidedAt: null,
      createdAt: new Date().toISOString(),
    }))
    mockApprovals.push(...created)
    return created
  }

  const inserted = await db
    .insert(vacationApprovals)
    .values(
      steps.map((s) => ({
        vacationId,
        step: s.step,
        approverId: s.approverId,
        status: "pending",
      }))
    )
    .returning()

  return inserted.map(mapApproval)
}

export async function listApprovals(vacationId: string): Promise<VacationApproval[]> {
  if (isMockDb()) {
    return mockApprovals
      .filter((a) => a.vacationId === vacationId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  }

  const rows = await db
    .select()
    .from(vacationApprovals)
    .where(eq(vacationApprovals.vacationId, vacationId))
    .orderBy(asc(vacationApprovals.createdAt))

  return rows.map(mapApproval)
}

export async function listApprovalsForVacations(
  vacationIds: string[]
): Promise<Record<string, VacationApproval[]>> {
  const result: Record<string, VacationApproval[]> = {}
  for (const id of vacationIds) result[id] = []

  if (vacationIds.length === 0) return result

  if (isMockDb()) {
    for (const a of mockApprovals) {
      if (result[a.vacationId]) result[a.vacationId].push(a)
    }
    return result
  }

  const rows = await db
    .select()
    .from(vacationApprovals)
    .where(inArray(vacationApprovals.vacationId, vacationIds))
    .orderBy(asc(vacationApprovals.createdAt))

  for (const row of rows) {
    result[row.vacationId]?.push(mapApproval(row))
  }
  return result
}

export async function decideApproval(params: {
  vacationId: string
  step: VacationApprovalStep
  status: "approved" | "rejected"
  comment?: string | null
  actorId: string
}): Promise<VacationApproval> {
  const { vacationId, step, status, comment, actorId } = params

  if (isMockDb()) {
    const index = mockApprovals.findIndex((a) => a.vacationId === vacationId && a.step === step)
    if (index < 0) throw new Error("Шаг согласования не найден")
    mockApprovals[index] = {
      ...mockApprovals[index],
      status,
      comment: comment ?? null,
      approverId: mockApprovals[index].approverId ?? actorId,
      decidedAt: new Date().toISOString(),
    }

    if (status === "rejected") {
      // reject vacation
      // handled by caller for mock via portal repo
    } else {
      const remaining = mockApprovals.filter(
        (a) => a.vacationId === vacationId && a.status === "pending"
      )
      if (remaining.length === 0) {
        // all approved — caller may update vacation
      }
    }
    return mockApprovals[index]
  }

  const [existing] = await db
    .select()
    .from(vacationApprovals)
    .where(and(eq(vacationApprovals.vacationId, vacationId), eq(vacationApprovals.step, step)))
    .limit(1)

  if (!existing) throw new Error("Шаг согласования не найден")

  const [updated] = await db
    .update(vacationApprovals)
    .set({
      status,
      comment: comment ?? existing.comment,
      approverId: existing.approverId ?? actorId,
      decidedAt: new Date(),
    })
    .where(eq(vacationApprovals.id, existing.id))
    .returning()

  if (!updated) throw new Error("Не удалось обновить согласование")

  if (status === "rejected") {
    await db
      .update(vacations)
      .set({ status: "rejected", approvedBy: actorId, comment: comment ?? undefined })
      .where(eq(vacations.id, vacationId))
  } else {
    const pending = await db
      .select({ id: vacationApprovals.id })
      .from(vacationApprovals)
      .where(
        and(eq(vacationApprovals.vacationId, vacationId), eq(vacationApprovals.status, "pending"))
      )
      .limit(1)

    if (pending.length === 0) {
      await db
        .update(vacations)
        .set({ status: "approved", approvedBy: actorId })
        .where(eq(vacations.id, vacationId))
    }
  }

  return mapApproval(updated)
}
