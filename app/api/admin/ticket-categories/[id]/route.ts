import { NextRequest, NextResponse } from "next/server"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  ticketCategoryItemSchema,
  ticketCategoryUpsertSchema,
} from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    const body = await request.json()
    const parsed = ticketCategoryUpsertSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные категории", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const updated = await getPortalRepositoryServer().updateTicketCategory(id, parsed.data)
    await writeAuditLog({
      action: "admin:ticket-categories:update",
      resourceType: "ticket_categories",
      resourceId: id,
      statusCode: 200,
    })
    return NextResponse.json(ticketCategoryItemSchema.parse(updated))
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось обновить категорию", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    await getPortalRepositoryServer().deleteTicketCategory(id)
    await writeAuditLog({
      action: "admin:ticket-categories:delete",
      resourceType: "ticket_categories",
      resourceId: id,
      statusCode: 204,
    })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось удалить категорию", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
