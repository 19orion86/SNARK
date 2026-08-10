import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { db } from "@/lib/db/client"
import { automationRules } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { apiErrorSchema } from "@/lib/validators/portal"

const ruleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  trigger: z.string().trim().min(1).max(100),
  action: z.string().trim().min(1).max(100),
  config: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (auth.role !== "admin") {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Только admin", code: "FORBIDDEN" }),
        { status: 403 }
      )
    }
    if (isMockDb()) return NextResponse.json({ items: [] })
    const items = await db.select().from(automationRules)
    return NextResponse.json({
      items: items.map((row) => ({
        id: row.id,
        name: row.name,
        trigger: row.trigger,
        action: row.action,
        config: row.config,
        isActive: row.isActive,
        createdAt: row.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить правила" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (auth.role !== "admin") {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Только admin", code: "FORBIDDEN" }),
        { status: 403 }
      )
    }
    const parsed = ruleSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректное правило", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    if (isMockDb()) {
      return NextResponse.json(
        {
          item: {
            id: crypto.randomUUID(),
            ...parsed.data,
            isActive: parsed.data.isActive ?? true,
            createdAt: new Date().toISOString(),
          },
        },
        { status: 201 }
      )
    }
    const [row] = await db
      .insert(automationRules)
      .values({
        name: parsed.data.name,
        trigger: parsed.data.trigger,
        action: parsed.data.action,
        config: parsed.data.config ?? {},
        isActive: parsed.data.isActive ?? true,
        createdBy: auth.userId,
      })
      .returning()
    return NextResponse.json({ item: row }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось создать правило" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
