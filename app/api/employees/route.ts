import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  employeesQuerySchema,
  employeesResponseSchema,
} from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    const url = new URL(request.url)
    const parsed = employeesQuerySchema.safeParse({
      search: url.searchParams.get("search") ?? undefined,
      department: url.searchParams.get("department") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    })

    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные параметры запроса",
        code: "INVALID_QUERY",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const data = await getPortalRepositoryServer().getContactsData(parsed.data)
    const response = employeesResponseSchema.parse({
      items: data.employees,
      departments: data.departments,
      total: data.total ?? data.employees.length,
      page: data.page ?? parsed.data.page,
      limit: data.limit ?? parsed.data.limit,
    })

    return NextResponse.json(response)
  } catch (error) {
    const known = error as Partial<AuthError>
    if (known.status) {
      const payload = apiErrorSchema.parse({
        error: known.message ?? "Ошибка авторизации",
        code: known.code ?? "AUTH_ERROR",
      })
      return NextResponse.json(payload, { status: known.status })
    }
    const payload = apiErrorSchema.parse({
      error: "Не удалось загрузить сотрудников",
      code: "INTERNAL_ERROR",
    })
    return NextResponse.json(payload, { status: 500 })
  }
}
