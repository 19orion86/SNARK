import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { createDeal, listDeals } from "@/lib/repositories/deals.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

const createSchema = z.object({
  title: z.string().trim().min(1).max(500),
  companyId: z.string().uuid().optional().nullable(),
  stageId: z.string().uuid().optional().nullable(),
  amount: z.number().int().optional().nullable(),
  source: z.string().trim().max(200).optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    const items = await listDeals()
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить сделки" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные сделки", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const created = await createDeal({ ...parsed.data, ownerId: auth.userId })
    await writeAuditLog({
      userId: auth.userId,
      action: "user:deals:create",
      resourceType: "deals",
      resourceId: created.id,
      statusCode: 201,
    })
    return NextResponse.json({ item: created }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось создать сделку" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
