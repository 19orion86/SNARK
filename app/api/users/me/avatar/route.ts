import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import { saveAvatarFile, validateAvatarFile } from "@/lib/storage/save-avatar-file"
import { apiErrorSchema, currentUserResponseSchema } from "@/lib/validators/portal"

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      const payload = apiErrorSchema.parse({
        error: "Выберите файл изображения",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const validationError = validateAvatarFile(file)
    if (validationError) {
      const payload = apiErrorSchema.parse({
        error: validationError,
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const avatarUrl = await saveAvatarFile(auth.userId, file)
    const updated = await getPortalRepositoryServer().updateProfile(auth.userId, { avatarUrl })
    const response = currentUserResponseSchema.parse({ profile: updated })

    await writeAuditLog({
      userId: auth.userId,
      action: "profile:avatar-upload",
      resourceType: "users",
      resourceId: auth.userId,
      statusCode: 200,
    })

    return NextResponse.json(response)
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : undefined
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({
            error: message && message !== "AUTH_ERROR" ? message : "Не удалось загрузить фото",
            code: "INTERNAL_ERROR",
          })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка авторизации",
            code: known.code ?? "AUTH_ERROR",
          })

    await writeAuditLog({
      action: "profile:avatar-upload",
      resourceType: "users",
      statusCode: status,
    })
    return NextResponse.json(payload, { status })
  }
}
