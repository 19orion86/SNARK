import { NextRequest, NextResponse } from "next/server"
import { requestReindex } from "@/lib/assistant/client"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  knowledgeEditorSchema,
  knowledgeListQuerySchema,
  knowledgeListResponseSchema,
} from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = knowledgeListQuerySchema.safeParse(params)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные параметры запроса",
        code: "INVALID_QUERY",
      })
      return NextResponse.json(payload, { status: 400 })
    }
    const data = await getPortalRepositoryServer().listKnowledgeArticles(parsed.data, true)
    const response = knowledgeListResponseSchema.parse(data)
    return NextResponse.json(response)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({
            error: "Не удалось загрузить статьи",
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
    const auth = requireRole(request, ["admin", "hr_manager"])
    const body = await request.json()
    const parsed = knowledgeEditorSchema.safeParse(body)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные данные статьи",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }
    const created = await getPortalRepositoryServer().createKnowledgeArticle({
      ...parsed.data,
      authorId: auth.userId,
    })
    // Ассистент: опубликованная статья попадает в индекс, черновик — нет (решает сервис).
    await requestReindex("article", created.id)
    await writeAuditLog({
      userId: auth.userId,
      action: "admin:knowledge:create",
      resourceType: "knowledge",
      resourceId: created.id,
      statusCode: 201,
    })
    return NextResponse.json({ item: created }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({
            error: "Не удалось создать статью",
            code: "INTERNAL_ERROR",
          })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
