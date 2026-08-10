import { asc, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { isMockDb } from "@/lib/config/mode"
import { db } from "@/lib/db/client"
import { dashboardWidgets } from "@/lib/db/schema"
import { apiErrorSchema } from "@/lib/validators/portal"

export const WIDGET_TYPES = [
  "birthdays",
  "new_hires",
  "news",
  "my_tasks",
  "overdue",
  "unread_chats",
] as const

export type DashboardWidgetType = (typeof WIDGET_TYPES)[number]

export interface DashboardWidgetItem {
  id: string
  widgetType: DashboardWidgetType
  sortOrder: number
  enabled: boolean
  config: Record<string, unknown> | null
}

const DEFAULT_WIDGETS: Array<{ widgetType: DashboardWidgetType; sortOrder: number; enabled: boolean }> = [
  { widgetType: "news", sortOrder: 0, enabled: true },
  { widgetType: "birthdays", sortOrder: 1, enabled: true },
  { widgetType: "new_hires", sortOrder: 2, enabled: true },
  { widgetType: "my_tasks", sortOrder: 3, enabled: true },
  { widgetType: "overdue", sortOrder: 4, enabled: true },
  { widgetType: "unread_chats", sortOrder: 5, enabled: false },
]

const putSchema = z.object({
  items: z
    .array(
      z.object({
        widgetType: z.enum(WIDGET_TYPES),
        sortOrder: z.number().int().min(0),
        enabled: z.boolean().optional().default(true),
        config: z.record(z.string(), z.unknown()).nullable().optional(),
      })
    )
    .min(1)
    .max(20),
})

const mockStore = new Map<string, DashboardWidgetItem[]>()

function defaultsForUser(userId: string): DashboardWidgetItem[] {
  return DEFAULT_WIDGETS.map((item, index) => ({
    id: `${userId}-${item.widgetType}`,
    widgetType: item.widgetType,
    sortOrder: item.sortOrder ?? index,
    enabled: item.enabled,
    config: null,
  }))
}

function parseEnabled(config: unknown): boolean {
  if (!config || typeof config !== "object") return true
  const enabled = (config as { enabled?: unknown }).enabled
  return enabled === undefined ? true : Boolean(enabled)
}

async function listWidgets(userId: string): Promise<DashboardWidgetItem[]> {
  if (isMockDb()) {
    return mockStore.get(userId) ?? defaultsForUser(userId)
  }

  const rows = await db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.userId, userId))
    .orderBy(asc(dashboardWidgets.sortOrder))

  if (rows.length === 0) return defaultsForUser(userId)

  return rows.map((row) => ({
    id: row.id,
    widgetType: row.widgetType as DashboardWidgetType,
    sortOrder: row.sortOrder,
    enabled: parseEnabled(row.config),
    config: (row.config as Record<string, unknown> | null) ?? null,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const items = await listWidgets(auth.userId)
    return NextResponse.json({ items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить виджеты" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const parsed = putSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректная раскладка виджетов", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const items: DashboardWidgetItem[] = parsed.data.items.map((item, index) => ({
      id: `${auth.userId}-${item.widgetType}`,
      widgetType: item.widgetType,
      sortOrder: item.sortOrder ?? index,
      enabled: item.enabled ?? true,
      config: { ...(item.config ?? {}), enabled: item.enabled ?? true },
    }))

    if (isMockDb()) {
      mockStore.set(auth.userId, items)
      return NextResponse.json({ items })
    }

    await db.delete(dashboardWidgets).where(eq(dashboardWidgets.userId, auth.userId))
    await db.insert(dashboardWidgets).values(
      items.map((item) => ({
        userId: auth.userId,
        widgetType: item.widgetType,
        sortOrder: item.sortOrder,
        config: item.config,
      }))
    )

    const saved = await listWidgets(auth.userId)
    return NextResponse.json({ items: saved })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось сохранить виджеты" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
