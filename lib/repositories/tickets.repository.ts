import "server-only"
import { asc, eq } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "@/lib/db/client"
import { ticketComments, tickets, users } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import type { Ticket } from "@/types/portal"

export interface TicketComment {
  id: string
  ticketId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

const commentAuthor = alias(users, "ticket_comment_author")

const mockComments: TicketComment[] = []

export async function getTicketForUser(
  ticketId: string,
  userId: string,
  role?: string
): Promise<Ticket | null> {
  const result = await getPortalRepositoryServer().getTicketById(ticketId, {
    userId,
    role: (role ?? "employee") as "admin" | "hr_manager" | "employee",
  })
  return result.item
}

export async function listComments(
  ticketId: string,
  userId: string,
  role?: string
): Promise<TicketComment[]> {
  const ticket = await getTicketForUser(ticketId, userId, role)
  if (!ticket) throw new Error("Заявка не найдена")

  if (isMockDb()) {
    return mockComments
      .filter((c) => c.ticketId === ticketId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  }

  const rows = await db
    .select({
      id: ticketComments.id,
      ticketId: ticketComments.ticketId,
      authorId: ticketComments.authorId,
      authorFirstName: commentAuthor.firstName,
      authorLastName: commentAuthor.lastName,
      body: ticketComments.body,
      createdAt: ticketComments.createdAt,
    })
    .from(ticketComments)
    .leftJoin(commentAuthor, eq(commentAuthor.id, ticketComments.authorId))
    .where(eq(ticketComments.ticketId, ticketId))
    .orderBy(asc(ticketComments.createdAt))

  return rows.map((row) => ({
    id: row.id,
    ticketId: row.ticketId,
    authorId: row.authorId,
    authorName: `${row.authorLastName ?? ""} ${row.authorFirstName ?? ""}`.trim() || "Сотрудник",
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function addComment(
  ticketId: string,
  body: string,
  authorId: string,
  role?: string
): Promise<TicketComment> {
  const ticket = await getTicketForUser(ticketId, authorId, role)
  if (!ticket) throw new Error("Заявка не найдена")

  if (isMockDb()) {
    const comment: TicketComment = {
      id: crypto.randomUUID(),
      ticketId,
      authorId,
      authorName: "Вы",
      body,
      createdAt: new Date().toISOString(),
    }
    mockComments.push(comment)
    return comment
  }

  const [created] = await db
    .insert(ticketComments)
    .values({ ticketId, authorId, body })
    .returning()

  if (!created) throw new Error("Не удалось добавить комментарий")

  const { markFirstResponseIfNeeded } = await import("@/lib/repositories/ticket-sla.repository")
  await markFirstResponseIfNeeded({ ticketId, authorId, role })

  const [author] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1)

  return {
    id: created.id,
    ticketId: created.ticketId,
    authorId: created.authorId,
    authorName: `${author?.lastName ?? ""} ${author?.firstName ?? ""}`.trim() || "Сотрудник",
    body: created.body,
    createdAt: created.createdAt.toISOString(),
  }
}

export async function loadTicketRaw(ticketId: string): Promise<{
  id: string
  subject: string
  description: string | null
  authorId: string
  assigneeId: string | null
} | null> {
  if (isMockDb()) {
    const ticket = await getPortalRepositoryServer().getTicketById(ticketId, {
      userId: "mock",
      role: "admin",
    })
    if (!ticket.item) return null
    return {
      id: ticket.item.id,
      subject: ticket.item.subject,
      description: ticket.item.description,
      authorId: ticket.item.authorId,
      assigneeId: ticket.item.assigneeId,
    }
  }

  const [row] = await db
    .select({
      id: tickets.id,
      subject: tickets.subject,
      description: tickets.description,
      authorId: tickets.authorId,
      assigneeId: tickets.assigneeId,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1)

  return row ?? null
}
