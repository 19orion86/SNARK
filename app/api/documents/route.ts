import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import { apiErrorSchema, documentsQuerySchema, documentsResponseSchema } from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const url = new URL(request.url)
    const parsed = documentsQuerySchema.safeParse({
      category: url.searchParams.get("category") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    })

    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные параметры запроса",
        code: "INVALID_QUERY",
      })
      await writeAuditLog({
        userId: auth.userId,
        action: "documents:list",
        resourceType: "documents",
        statusCode: 400,
        metadata: JSON.stringify({ reason: "invalid_query" }),
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const [currentUser] = await db
      .select({ departmentId: users.departmentId })
      .from(users)
      .where(eq(users.id, auth.userId))

    const data = await getPortalRepositoryServer().getDocumentsData(parsed.data, {
      role: auth.role,
      userId: auth.userId,
      departmentId: currentUser?.departmentId ?? null,
    })

    const response = documentsResponseSchema.parse({
      items: data.documents,
      categories: data.categories,
      total: data.total ?? data.documents.length,
      page: data.page ?? parsed.data.page,
      limit: data.limit ?? parsed.data.limit,
    })

    return NextResponse.json(response)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось загрузить документы", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка авторизации",
            code: known.code ?? "AUTH_ERROR",
          })

    await writeAuditLog({
      action: "documents:list",
      resourceType: "documents",
      statusCode: status,
      metadata: JSON.stringify({ code: payload.code }),
    })
    return NextResponse.json(payload, { status })
  }
}
