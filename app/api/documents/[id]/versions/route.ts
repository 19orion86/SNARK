import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import {
  addDocumentVersion,
  assertDocumentExists,
  listDocumentVersions,
} from "@/lib/repositories/document-versions.repository"
import {
  apiErrorSchema,
  documentVersionCreateSchema,
  documentVersionSchema,
} from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

const idSchema = z.string().uuid()

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireAuth(request)
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный идентификатор", code: "INVALID_ID" }),
        { status: 400 }
      )
    }

    const exists = await assertDocumentExists(parsedId.data)
    if (!exists) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Документ не найден", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }

    const items = await listDocumentVersions(parsedId.data)
    return NextResponse.json({ items: items.map((item) => documentVersionSchema.parse(item)) })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить версии" : (known.message ?? "Ошибка"),
        code: known.code ?? (status === 500 ? "INTERNAL_ERROR" : "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный идентификатор", code: "INVALID_ID" }),
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = documentVersionCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные данные версии", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const fileUrl = parsed.data.fileUrl?.trim() ? parsed.data.fileUrl.trim() : null
    const item = await addDocumentVersion({
      documentId: parsedId.data,
      versionLabel: parsed.data.versionLabel,
      changeNote: parsed.data.changeNote ?? null,
      fileUrl,
      uploadedBy: auth.userId,
    })

    await writeAuditLog({
      userId: auth.userId,
      action: "admin:documents:version:create",
      resourceType: "document_versions",
      resourceId: item.id,
      statusCode: 201,
    })

    return NextResponse.json({ item: documentVersionSchema.parse(item) }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось добавить версию"
    const status =
      known.status ?? (message.includes("не найден") ? 404 : message.includes("Укажите") ? 400 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось добавить версию" : (known.message ?? message),
        code:
          status === 404
            ? "NOT_FOUND"
            : status === 400
              ? "INVALID_PAYLOAD"
              : status === 500
                ? "INTERNAL_ERROR"
                : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
