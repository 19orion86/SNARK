import { NextRequest, NextResponse } from "next/server"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  ticketCategoriesResponseSchema,
  ticketCategoryItemSchema,
  ticketCategoryUpsertSchema,
} from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const data = await getPortalRepositoryServer().listTicketCategories(false)
    return NextResponse.json(ticketCategoriesResponseSchema.parse(data))
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось загрузить категории", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const body = await request.json()
    const parsed = ticketCategoryUpsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные категории", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const created = await getPortalRepositoryServer().createTicketCategory(parsed.data)
    await writeAuditLog({
      action: "admin:ticket-categories:create",
      resourceType: "ticket_categories",
      resourceId: created.id,
      statusCode: 201,
    })
    return NextResponse.json(ticketCategoryItemSchema.parse(created), { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось создать категорию", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
