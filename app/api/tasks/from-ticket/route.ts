import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { createTask, getTaskDetail } from "@/lib/repositories/tasks.repository"
import { addTaskLink } from "@/lib/repositories/task-links.repository"
import { getTicketForUser, loadTicketRaw } from "@/lib/repositories/tickets.repository"
import { apiErrorSchema, taskDetailResponseSchema } from "@/lib/validators/portal"

const fromTicketSchema = z.object({
  ticketId: z.string().uuid(),
  title: z.string().trim().min(1).max(500).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const body = await request.json()
    const parsed = fromTicketSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    let accessible: {
      id: string
      subject: string
      description: string | null
      authorId: string
      assigneeId: string | null
    } | null = null

    if (auth.role === "admin" || auth.role === "hr_manager") {
      accessible = await loadTicketRaw(parsed.data.ticketId)
    } else {
      const ticket = await getTicketForUser(parsed.data.ticketId, auth.userId, auth.role)
      if (ticket) {
        accessible = {
          id: ticket.id,
          subject: ticket.subject,
          description: ticket.description,
          authorId: ticket.authorId,
          assigneeId: ticket.assigneeId,
        }
      }
    }

    if (!accessible) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Заявка не найдена", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }

    const title = parsed.data.title?.trim() || `Заявка: ${accessible.subject}`
    const created = await createTask({
      title,
      description: accessible.description,
      assigneeId: parsed.data.assigneeId ?? accessible.assigneeId,
      creatorId: auth.userId,
    })

    try {
      await addTaskLink(created.id, "ticket", accessible.id, auth.userId, auth.role)
    } catch {
      // link may fail ACL in edge cases; task still created
    }

    const detail =
      (await getTaskDetail(created.id, auth.userId, auth.role)) ?? {
        ...created,
        checklist: [],
        comments: [],
        participants: [],
        attachments: [],
        subtasks: [],
        activity: [],
      }

    await writeAuditLog({
      userId: auth.userId,
      action: "user:tasks:create-from-ticket",
      resourceType: "tasks",
      resourceId: created.id,
      statusCode: 201,
      metadata: JSON.stringify({ ticketId: accessible.id }),
    })

    return NextResponse.json(taskDetailResponseSchema.parse({ item: detail }), { status: 201 })
  } catch (error) {
    console.error("[POST /api/tasks/from-ticket]", error)
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось создать задачу" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
