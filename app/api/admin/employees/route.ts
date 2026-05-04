import { NextRequest, NextResponse } from "next/server"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  adminEmployeesResponseSchema,
  adminEmployeeUpsertSchema,
  apiErrorSchema,
} from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const data = await getPortalRepositoryServer().listAdminEmployees()
    const response = adminEmployeesResponseSchema.parse(data)

    await writeAuditLog({
      userId: auth.userId,
      action: "admin:employees:list",
      resourceType: "users",
      statusCode: 200,
    })
    return NextResponse.json(response)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось загрузить сотрудников", code: "INTERNAL_ERROR" })
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
    const parsed = adminEmployeeUpsertSchema.safeParse(body)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные данные сотрудника",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const created = await getPortalRepositoryServer().createAdminEmployee(parsed.data)
    await writeAuditLog({
      userId: auth.userId,
      action: "admin:employees:create",
      resourceType: "users",
      resourceId: created.id,
      statusCode: 201,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось создать сотрудника", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
