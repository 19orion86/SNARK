import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { db } from "@/lib/db/client"
import { taskTemplates } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { apiErrorSchema, taskPriorityEnum } from "@/lib/validators/portal"

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(5000).optional().nullable(),
  priority: taskPriorityEnum.optional(),
  checklist: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
})

const mockTemplates: Array<{
  id: string
  name: string
  title: string
  description: string | null
  priority: string
  checklistJson: string[]
  creatorId: string
}> = []

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (isMockDb()) {
      return NextResponse.json({
        items: mockTemplates.filter((t) => t.creatorId === auth.userId),
      })
    }
    const items = await db.select().from(taskTemplates).where(eq(taskTemplates.creatorId, auth.userId))
    return NextResponse.json({
      items: items.map((row) => ({
        id: row.id,
        name: row.name,
        title: row.title,
        description: row.description,
        priority: row.priority,
        checklist: (row.checklistJson as string[] | null) ?? [],
        createdAt: row.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить шаблоны" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const parsed = createTemplateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный шаблон", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    if (isMockDb()) {
      const item = {
        id: crypto.randomUUID(),
        name: parsed.data.name,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        priority: parsed.data.priority ?? "medium",
        checklistJson: parsed.data.checklist ?? [],
        creatorId: auth.userId,
      }
      mockTemplates.unshift(item)
      return NextResponse.json({ item }, { status: 201 })
    }
    const [row] = await db
      .insert(taskTemplates)
      .values({
        name: parsed.data.name,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        priority: parsed.data.priority ?? "medium",
        checklistJson: parsed.data.checklist ?? [],
        creatorId: auth.userId,
      })
      .returning()
    return NextResponse.json({ item: row }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось создать шаблон" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
