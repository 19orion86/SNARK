import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import { createApprovalChain } from "@/lib/repositories/vacation-approvals.repository"
import { countWorkingDays } from "@/lib/utils/working-days"
import {
  apiErrorSchema,
  vacationCreateSchema,
  vacationItemSchema,
  vacationsListResponseSchema,
} from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const items = await getPortalRepositoryServer().listMyVacations(auth.userId)
    return NextResponse.json(vacationsListResponseSchema.parse({ items }))
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({
            error: "Не удалось загрузить заявки на отпуск",
            code: "INTERNAL_ERROR",
          })
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
    const parsed = vacationCreateSchema.safeParse(body)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные данные заявки на отпуск",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const daysTotal = countWorkingDays(parsed.data.startDate, parsed.data.endDate)
    if (daysTotal <= 0) {
      const payload = apiErrorSchema.parse({
        error: "В выбранном периоде нет рабочих дней",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const created = await getPortalRepositoryServer().createVacation({
      ...parsed.data,
      userId: auth.userId,
      daysTotal,
    })

    try {
      await createApprovalChain(created.id, auth.userId)
    } catch (error) {
      console.error("[POST /api/vacations] approval chain", error)
    }

    await writeAuditLog({
      userId: auth.userId,
      action: "user:vacations:create",
      resourceType: "vacations",
      resourceId: created.id,
      statusCode: 201,
    })

    return NextResponse.json(vacationItemSchema.parse(created), { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({
            error: "Не удалось создать заявку на отпуск",
            code: "INTERNAL_ERROR",
          })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
