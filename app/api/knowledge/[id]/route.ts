import { NextRequest, NextResponse } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/request-auth"
import { z } from "zod"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  knowledgeDetailResponseSchema,
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
      const payload = apiErrorSchema.parse({
        error: "Некорректный идентификатор",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }
    const repo = getPortalRepositoryServer()
    const data = await repo.getKnowledgeArticleById(parsedId.data, false)
    if (!data.item) {
      const payload = apiErrorSchema.parse({
        error: "Статья не найдена",
        code: "NOT_FOUND",
      })
      return NextResponse.json(payload, { status: 404 })
    }
    await repo.incrementKnowledgeArticleViews(parsedId.data)
    const item = { ...data.item, viewsCount: data.item.viewsCount + 1 }
    return NextResponse.json(knowledgeDetailResponseSchema.parse({ item }))
  } catch (error) {
    if (error instanceof AuthError) {
      const payload = apiErrorSchema.parse({ error: error.message, code: error.code })
      return NextResponse.json(payload, { status: error.status })
    }
    const payload = apiErrorSchema.parse({
      error: "Не удалось загрузить статью",
      code: "INTERNAL_ERROR",
    })
    return NextResponse.json(payload, { status: 500 })
  }
}
