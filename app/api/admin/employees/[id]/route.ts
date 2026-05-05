import { NextRequest, NextResponse } from "next/server"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  adminEmployeeHideSchema,
  adminEmployeeUpsertSchema,
  apiErrorSchema,
} from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    const body = await request.json()

    const hideParsed = adminEmployeeHideSchema.safeParse(body)
    if (hideParsed.success) {
      const hidden = await getPortalRepositoryServer().hideAdminEmployee(id, hideParsed.data.hidden)
      await writeAuditLog({
        userId: auth.userId,
        action: "admin:employees:hide",
        resourceType: "users",
        resourceId: id,
        statusCode: 200,
      })
      return NextResponse.json(hidden)
    }

    const parsed = adminEmployeeUpsertSchema.safeParse(body)
    if (!parsed.success) {
      const payload = apiErrorSchema.parse({
        error: "Некорректные данные сотрудника",
        code: "INVALID_PAYLOAD",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const updated = await getPortalRepositoryServer().updateAdminEmployee(id, parsed.data)
    await writeAuditLog({
      userId: auth.userId,
      action: "admin:employees:update",
      resourceType: "users",
      resourceId: id,
      statusCode: 200,
    })
    return NextResponse.json(updated)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось обновить сотрудника", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireRole(request, ["admin"])
    // только admin может удалять — hr_manager может только скрывать
    const { id } = await context.params

    await getPortalRepositoryServer().deleteAdminEmployee(id)

    await writeAuditLog({
      userId: auth.userId,
      action: "admin:employees:delete",
      resourceType: "users",
      resourceId: id,
      statusCode: 200,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось удалить сотрудника", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
