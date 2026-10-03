import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/request-auth"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  knowledgeListQuerySchema,
  knowledgeListResponseSchema,
} from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = knowledgeListQuerySchema.safeParse(params)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные параметры запроса",
        code: "INVALID_QUERY",
      })
      return NextResponse.json(payload, { status: 400 })
    }
    const data = await getPortalRepositoryServer().listKnowledgeArticles(parsed.data, false)
    const response = knowledgeListResponseSchema.parse(data)
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof AuthError) {
      const payload = apiErrorSchema.parse({ error: error.message, code: error.code })
      return NextResponse.json(payload, { status: error.status })
    }
    const payload = apiErrorSchema.parse({
      error: "Не удалось загрузить статьи базы знаний",
      code: "INTERNAL_ERROR",
    })
    return NextResponse.json(payload, { status: 500 })
  }
}
