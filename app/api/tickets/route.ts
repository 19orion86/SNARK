import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  ticketCreateSchema,
  ticketDetailResponseSchema,
  ticketsListQuerySchema,
  ticketsListResponseSchema,
} from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = ticketsListQuerySchema.safeParse(params)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные параметры заявок",
        code: "INVALID_QUERY",
      })
      return NextResponse.json(payload, { status: 400 })
    }
    const data = await getPortalRepositoryServer().listMyTickets(auth.userId, parsed.data)
    return NextResponse.json(ticketsListResponseSchema.parse(data))
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось загрузить заявки", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const body = await request.json()
    const parsed = ticketCreateSchema.safeParse(body)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные данные заявки",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const categories = await getPortalRepositoryServer().listTicketCategories(true)
    const categoryExists = categories.items.some((item) => item.slug === parsed.data.category)
    if (!categoryExists) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Выбрана недоступная категория", code: "INVALID_CATEGORY" }),
        { status: 400 }
      )
    }

    const created = await getPortalRepositoryServer().createTicket({
      ...parsed.data,
      authorId: auth.userId,
    })
    await writeAuditLog({
      userId: auth.userId,
      action: "user:tickets:create",
      resourceType: "tickets",
      resourceId: created.id,
      statusCode: 201,
    })
    return NextResponse.json(
      ticketDetailResponseSchema.parse({ item: created }),
      { status: 201 }
    )
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось создать заявку", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
