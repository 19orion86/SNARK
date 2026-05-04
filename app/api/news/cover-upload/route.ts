import { NextRequest, NextResponse } from "next/server"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { getFileStorage } from "@/lib/storage"
import {
  apiErrorSchema,
  newsCoverUploadResponseSchema,
  newsCoverUploadSchema,
} from "@/lib/validators/portal"

export async function POST(request: NextRequest) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const body = await request.json()
    const parsed = newsCoverUploadSchema.safeParse(body)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные параметры загрузки",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const ext = parsed.data.fileName.split(".").pop() ?? "bin"
    const objectKey = `news/covers/${crypto.randomUUID()}.${ext}`
    const storage = getFileStorage()
    const upload = await storage.getPresignedUploadUrl({
      objectKey,
      contentType: parsed.data.contentType,
      expiresInSeconds: 300,
    })
    const fileUrl = await storage.getPreviewUrl(objectKey)
    const response = newsCoverUploadResponseSchema.parse({
      uploadUrl: upload.uploadUrl,
      objectKey,
      fileUrl,
      expiresAt: upload.expiresAt,
    })
    return NextResponse.json(response)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось подготовить загрузку", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
