import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { listPolicies, upsertPolicy } from "@/lib/repositories/ticket-sla.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

const putSchema = z.object({
  firstResponseMinutes: z.number().int().min(1).max(10080),
  resolveMinutes: z.number().int().min(1).max(43200),
  categoryId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const items = await listPolicies()
    const defaultPolicy =
      items.find((item) => item.categoryId == null) ??
      ({
        id: "default",
        categoryId: null,
        firstResponseMinutes: 60,
        resolveMinutes: 1440,
        isActive: true,
        createdAt: new Date().toISOString(),
      } as const)
    return NextResponse.json({ items, defaultPolicy })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить SLA" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const parsed = putSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные параметры SLA", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const item = await upsertPolicy({
      categoryId: parsed.data.categoryId ?? null,
      firstResponseMinutes: parsed.data.firstResponseMinutes,
      resolveMinutes: parsed.data.resolveMinutes,
      isActive: parsed.data.isActive ?? true,
    })
    return NextResponse.json({ item })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось сохранить SLA" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
