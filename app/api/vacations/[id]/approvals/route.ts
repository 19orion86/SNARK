import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import {
  decideApproval,
  listApprovals,
  type VacationApprovalStep,
} from "@/lib/repositories/vacation-approvals.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

const idSchema = z.string().uuid()
const decideSchema = z.object({
  step: z.enum(["manager", "hr"]),
  status: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(1000).optional().nullable(),
})

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireAuth(request)
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный идентификатор отпуска", code: "INVALID_ID" }),
        { status: 400 }
      )
    }
    const items = await listApprovals(parsedId.data)
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error:
          status === 500 ? "Не удалось загрузить согласования" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный идентификатор отпуска", code: "INVALID_ID" }),
        { status: 400 }
      )
    }
    const body = await request.json()
    const parsed = decideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные согласования", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const updated = await decideApproval({
      vacationId: parsedId.data,
      step: parsed.data.step as VacationApprovalStep,
      status: parsed.data.status,
      comment: parsed.data.comment,
      actorId: auth.userId,
    })

    await writeAuditLog({
      userId: auth.userId,
      action: "admin:vacations:approval",
      resourceType: "vacations",
      resourceId: parsedId.data,
      statusCode: 200,
      metadata: JSON.stringify({ step: parsed.data.step, status: parsed.data.status }),
    })

    return NextResponse.json({ item: updated })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось согласовать"
    const status =
      known.status ?? (message.includes("не найден") ? 404 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? message : (known.message ?? message),
        code: status === 404 ? "NOT_FOUND" : status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
