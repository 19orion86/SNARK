import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import { apiErrorSchema, currentUserResponseSchema, profileUpdateSchema } from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const profile = await getPortalRepositoryServer().getCurrentUserProfile(auth.userId)
    if (!profile) {
      const payload = apiErrorSchema.parse({
        error: "Профиль пользователя не найден",
        code: "PROFILE_NOT_FOUND",
      })
      return NextResponse.json(payload, { status: 404 })
    }

    const response = currentUserResponseSchema.parse({ profile })
    return NextResponse.json(response)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось загрузить профиль", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка авторизации",
            code: known.code ?? "AUTH_ERROR",
          })

    await writeAuditLog({
      action: "profile:get",
      resourceType: "users",
      statusCode: status,
    })
    return NextResponse.json(payload, { status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const body = await request.json()
    const parsed = profileUpdateSchema.safeParse(body)

    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные данные профиля",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const updated = await getPortalRepositoryServer().updateProfile(auth.userId, parsed.data)
    const response = currentUserResponseSchema.parse({ profile: updated })

    await writeAuditLog({
      userId: auth.userId,
      action: "profile:update",
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
        ? apiErrorSchema.parse({ error: "Не удалось обновить профиль", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка авторизации",
            code: known.code ?? "AUTH_ERROR",
          })
    await writeAuditLog({
      action: "profile:update",
      resourceType: "users",
      statusCode: status,
    })
    return NextResponse.json(payload, { status })
  }
}
