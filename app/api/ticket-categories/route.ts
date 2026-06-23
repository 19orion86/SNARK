import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import { apiErrorSchema, ticketCategoriesResponseSchema } from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    const data = await getPortalRepositoryServer().listTicketCategories(true)
    return NextResponse.json(ticketCategoriesResponseSchema.parse(data))
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось загрузить категории", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка авторизации",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
