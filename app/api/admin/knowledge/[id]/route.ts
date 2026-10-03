import { NextRequest, NextResponse } from "next/server"
import { requestReindex } from "@/lib/assistant/client"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  knowledgeDetailResponseSchema,
  knowledgeEditorSchema,
} from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    const response = await getPortalRepositoryServer().getKnowledgeArticleById(id, true)
    return NextResponse.json(knowledgeDetailResponseSchema.parse(response))
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({
            error: "Не удалось загрузить статью",
            code: "INTERNAL_ERROR",
          })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    const body = await request.json()
    const parsed = knowledgeEditorSchema.safeParse(body)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные данные статьи",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }
    const item = await getPortalRepositoryServer().updateKnowledgeArticle(id, parsed.data)
    await requestReindex("article", id)
    await writeAuditLog({
      userId: auth.userId,
      action: "admin:knowledge:update",
      resourceType: "knowledge",
      resourceId: id,
      statusCode: 200,
    })
    return NextResponse.json(knowledgeDetailResponseSchema.parse({ item }))
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({
            error: "Не удалось обновить статью",
            code: "INTERNAL_ERROR",
          })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    await getPortalRepositoryServer().deleteKnowledgeArticle(id)
    await requestReindex("article", id)
    await writeAuditLog({
      userId: auth.userId,
      action: "admin:knowledge:delete",
      resourceType: "knowledge",
      resourceId: id,
      statusCode: 200,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({
            error: "Не удалось удалить статью",
            code: "INTERNAL_ERROR",
          })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
