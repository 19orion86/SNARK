import "server-only"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { ticketCategories, tickets, ticketSlaPolicies } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import type { Ticket } from "@/types/portal"

export interface TicketSlaPolicy {
  id: string
  categoryId: string | null
  firstResponseMinutes: number
  resolveMinutes: number
  isActive: boolean
  createdAt: string
}

function mapPolicy(row: typeof ticketSlaPolicies.$inferSelect): TicketSlaPolicy {
  return {
    id: row.id,
    categoryId: row.categoryId,
    firstResponseMinutes: row.firstResponseMinutes,
    resolveMinutes: row.resolveMinutes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listPolicies(): Promise<TicketSlaPolicy[]> {
  if (isMockDb()) return []
  const rows = await db.select().from(ticketSlaPolicies)
  return rows.map(mapPolicy)
}

export async function getPolicyForCategory(
  categoryId: string | null
): Promise<TicketSlaPolicy | null> {
  if (isMockDb()) return null

  if (categoryId) {
    const [byCategory] = await db
      .select()
      .from(ticketSlaPolicies)
      .where(
        and(eq(ticketSlaPolicies.categoryId, categoryId), eq(ticketSlaPolicies.isActive, true))
      )
      .limit(1)
    if (byCategory) return mapPolicy(byCategory)
  }

  const [fallback] = await db
    .select()
    .from(ticketSlaPolicies)
    .where(and(isNull(ticketSlaPolicies.categoryId), eq(ticketSlaPolicies.isActive, true)))
    .limit(1)
  return fallback ? mapPolicy(fallback) : null
}

export async function upsertPolicy(input: {
  categoryId?: string | null
  firstResponseMinutes: number
  resolveMinutes: number
  isActive?: boolean
}): Promise<TicketSlaPolicy> {
  if (isMockDb()) {
    return {
      id: crypto.randomUUID(),
      categoryId: input.categoryId ?? null,
      firstResponseMinutes: input.firstResponseMinutes,
      resolveMinutes: input.resolveMinutes,
      isActive: input.isActive ?? true,
      createdAt: new Date().toISOString(),
    }
  }

  const categoryId = input.categoryId ?? null
  const existing = categoryId
    ? (
        await db
          .select()
          .from(ticketSlaPolicies)
          .where(eq(ticketSlaPolicies.categoryId, categoryId))
          .limit(1)
      )[0]
    : (
        await db
          .select()
          .from(ticketSlaPolicies)
          .where(isNull(ticketSlaPolicies.categoryId))
          .limit(1)
      )[0]

  if (existing) {
    const [updated] = await db
      .update(ticketSlaPolicies)
      .set({
        firstResponseMinutes: input.firstResponseMinutes,
        resolveMinutes: input.resolveMinutes,
        isActive: input.isActive ?? true,
      })
      .where(eq(ticketSlaPolicies.id, existing.id))
      .returning()
    return mapPolicy(updated)
  }

  const [created] = await db
    .insert(ticketSlaPolicies)
    .values({
      categoryId,
      firstResponseMinutes: input.firstResponseMinutes,
      resolveMinutes: input.resolveMinutes,
      isActive: input.isActive ?? true,
    })
    .returning()
  return mapPolicy(created)
}

export function computeBreach(input: {
  createdAt: string | Date
  firstRespondedAt?: string | Date | null
  resolvedAt?: string | Date | null
  status: string
  firstResponseMinutes: number
  resolveMinutes: number
  now?: Date
}): boolean {
  const now = input.now ?? new Date()
  const createdAt = new Date(input.createdAt).getTime()
  const ageMinutes = (now.getTime() - createdAt) / 60_000

  if (!input.firstRespondedAt && ageMinutes > input.firstResponseMinutes) {
    return true
  }

  const isResolved = input.status === "resolved" || input.status === "closed" || !!input.resolvedAt
  if (!isResolved && ageMinutes > input.resolveMinutes) {
    return true
  }
  return false
}

async function resolveCategoryId(categorySlug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: ticketCategories.id })
    .from(ticketCategories)
    .where(eq(ticketCategories.slug, categorySlug))
    .limit(1)
  return row?.id ?? null
}

export async function applySlaToTicket(ticket: Ticket): Promise<Ticket> {
  if (isMockDb()) {
    return { ...ticket, firstRespondedAt: ticket.firstRespondedAt ?? null, slaBreached: false }
  }

  const categoryId = await resolveCategoryId(ticket.category)
  const policy = await getPolicyForCategory(categoryId)
  if (!policy) {
    return {
      ...ticket,
      firstRespondedAt: ticket.firstRespondedAt ?? null,
      slaBreached: ticket.slaBreached ?? false,
    }
  }

  const breached = computeBreach({
    createdAt: ticket.createdAt,
    firstRespondedAt: ticket.firstRespondedAt,
    resolvedAt: ticket.resolvedAt,
    status: ticket.status,
    firstResponseMinutes: policy.firstResponseMinutes,
    resolveMinutes: policy.resolveMinutes,
  })

  if (breached !== Boolean(ticket.slaBreached)) {
    await db
      .update(tickets)
      .set({ slaBreached: breached, updatedAt: new Date() })
      .where(eq(tickets.id, ticket.id))
  }

  return {
    ...ticket,
    firstRespondedAt: ticket.firstRespondedAt ?? null,
    slaBreached: breached,
  }
}

export async function markFirstResponseIfNeeded(input: {
  ticketId: string
  authorId: string
  role?: string
}): Promise<void> {
  if (isMockDb()) return

  const [ticket] = await db
    .select({
      id: tickets.id,
      assigneeId: tickets.assigneeId,
      firstRespondedAt: tickets.firstRespondedAt,
    })
    .from(tickets)
    .where(eq(tickets.id, input.ticketId))
    .limit(1)

  if (!ticket || ticket.firstRespondedAt) return

  const isStaff =
    input.role === "admin" ||
    input.role === "hr_manager" ||
    (ticket.assigneeId != null && ticket.assigneeId === input.authorId)

  if (!isStaff) return

  await db
    .update(tickets)
    .set({ firstRespondedAt: new Date(), updatedAt: new Date() })
    .where(eq(tickets.id, input.ticketId))
}
