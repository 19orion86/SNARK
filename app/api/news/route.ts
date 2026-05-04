import { NextRequest, NextResponse } from "next/server"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  newsEditorSchema,
  newsListQuerySchema,
  newsListResponseSchema,
} from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = newsListQuerySchema.safeParse(params)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные параметры новостей",
        code: "INVALID_QUERY",
      })
      return NextResponse.json(payload, { status: 400 })
    }
    const data = await getPortalRepositoryServer().getNewsList(parsed.data, false)
    const response = newsListResponseSchema.parse(data)
    return NextResponse.json(response)
  } catch {
    const payload = apiErrorSchema.parse({
      error: "Не удалось загрузить новости",
      code: "INTERNAL_ERROR",
    })
    return NextResponse.json(payload, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const body = await request.json()
    const parsed = newsEditorSchema.safeParse(body)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные данные новости",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }
    const created = await getPortalRepositoryServer().createNews({
      ...parsed.data,
      authorId: auth.userId,
    })
    await writeAuditLog({
      userId: auth.userId,
      action: "news:create",
      resourceType: "news",
      resourceId: created?.id ?? undefined,
      statusCode: 201,
    })
    return NextResponse.json({ item: created }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось создать новость", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
