import { NextRequest, NextResponse } from "next/server"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  newsDetailResponseSchema,
  newsEditorSchema,
} from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const response = await getPortalRepositoryServer().getNewsById(id, false)
    return NextResponse.json(newsDetailResponseSchema.parse(response))
  } catch {
    const payload = apiErrorSchema.parse({
      error: "Не удалось загрузить новость",
      code: "INTERNAL_ERROR",
    })
    return NextResponse.json(payload, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    const body = await request.json()
    const parsed = newsEditorSchema.safeParse(body)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные данные новости",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }
    const item = await getPortalRepositoryServer().updateNews(id, parsed.data)
    await writeAuditLog({
      userId: auth.userId,
      action: "news:update",
      resourceType: "news",
      resourceId: id,
      statusCode: 200,
    })
    return NextResponse.json(newsDetailResponseSchema.parse({ item }))
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось обновить новость", code: "INTERNAL_ERROR" })
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
    await getPortalRepositoryServer().deleteNews(id)
    await writeAuditLog({
      userId: auth.userId,
      action: "news:delete",
      resourceType: "news",
      resourceId: id,
      statusCode: 200,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось удалить новость", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
