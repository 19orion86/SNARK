import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import { apiErrorSchema, currentUserResponseSchema, profilePresenceSchema } from "@/lib/validators/portal"

export async function PATCH(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const body = await request.json()
    const parsed = profilePresenceSchema.safeParse(body)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректный статус присутствия",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const profile = await getPortalRepositoryServer().updateMyPresence(auth.userId, parsed.data)
    const response = currentUserResponseSchema.parse({ profile })

    await writeAuditLog({
      userId: auth.userId,
      action: "profile:presence:update",
      resourceType: "users",
      resourceId: auth.userId,
      statusCode: 200,
    })
    return NextResponse.json(response)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось обновить статус", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка авторизации",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
