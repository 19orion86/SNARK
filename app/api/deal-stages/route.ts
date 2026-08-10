import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { listStages } from "@/lib/repositories/deals.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    const items = await listStages()
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить стадии" : (known.message ?? "Ошибка доступа"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
