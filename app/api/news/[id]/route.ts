import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/request-auth"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import { apiErrorSchema, newsDetailResponseSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireAuth(request)
    const { id } = await context.params
    const response = await getPortalRepositoryServer().getNewsById(id, false)
    return NextResponse.json(newsDetailResponseSchema.parse(response))
  } catch (error) {
    if (error instanceof AuthError) {
      const payload = apiErrorSchema.parse({ error: error.message, code: error.code })
      return NextResponse.json(payload, { status: error.status })
    }
    const payload = apiErrorSchema.parse({
      error: "Не удалось загрузить новость",
      code: "INTERNAL_ERROR",
    })
    return NextResponse.json(payload, { status: 500 })
  }
}
