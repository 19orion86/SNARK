import { NextRequest, NextResponse } from "next/server"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import { getFileStorage } from "@/lib/storage"
import {
  apiErrorSchema,
  documentMetadataCreateResponseSchema,
  documentMetadataCreateSchema,
} from "@/lib/validators/portal"

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const body = await request.json()
    const parsed = documentMetadataCreateSchema.safeParse(body)

    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные данные документа",
        code: "INVALID_PAYLOAD",
      })
      await writeAuditLog({
        userId: auth.userId,
        action: "documents:metadata:create",
        resourceType: "documents",
        statusCode: 400,
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const metadata = await getPortalRepositoryServer().createDocumentMetadata({
      ...parsed.data,
      createdBy: auth.userId,
    })
    const storage = getFileStorage()
    const upload = await storage.getPresignedUploadUrl({
      objectKey: metadata.objectKey,
      contentType: parsed.data.contentType,
      expiresInSeconds: 900,
    })

    const response = documentMetadataCreateResponseSchema.parse({
      documentId: metadata.documentId,
      objectKey: metadata.objectKey,
      uploadUrl: upload.uploadUrl,
      expiresAt: upload.expiresAt,
    })

    await writeAuditLog({
      userId: auth.userId,
      action: "documents:metadata:create",
      resourceType: "documents",
      resourceId: response.documentId,
      statusCode: 201,
    })
    return NextResponse.json(response, { status: 201 })
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

    await writeAuditLog({
      action: "documents:metadata:create",
      resourceType: "documents",
      statusCode: status,
    })
    return NextResponse.json(payload, { status })
  }
}
