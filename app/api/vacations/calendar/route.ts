import { and, eq, gte, lte, or } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { isMockDb } from "@/lib/config/mode"
import { db } from "@/lib/db/client"
import { users, vacations } from "@/lib/db/schema"
import { formatFullName } from "@/lib/portal-data/format-name"
import { apiErrorSchema } from "@/lib/validators/portal"

export interface LeaveCalendarItem {
  userName: string
  departmentId: string | null
  startDate: string
  endDate: string
}

function parseMonth(value: string | null): { start: string; end: string; month: string } {
  const now = new Date()
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const month = value && /^\d{4}-\d{2}$/.test(value) ? value : fallback
  const [y, m] = month.split("-").map(Number)
  const start = `${month}-01`
  const lastDay = new Date(y!, m!, 0).getDate()
  const end = `${month}-${String(lastDay).padStart(2, "0")}`
  return { start, end, month }
}

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    const { start, end, month } = parseMonth(request.nextUrl.searchParams.get("month"))

    if (isMockDb()) {
      return NextResponse.json({
        month,
        items: [] as LeaveCalendarItem[],
      })
    }

    const rows = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        departmentId: users.departmentId,
        startDate: vacations.startDate,
        endDate: vacations.endDate,
      })
      .from(vacations)
      .innerJoin(users, eq(users.id, vacations.userId))
      .where(
        and(
          eq(vacations.status, "approved"),
          or(
            and(gte(vacations.startDate, start), lte(vacations.startDate, end)),
            and(gte(vacations.endDate, start), lte(vacations.endDate, end)),
            and(lte(vacations.startDate, start), gte(vacations.endDate, end))
          )
        )
      )

    const items: LeaveCalendarItem[] = rows.map((row) => ({
      userName: formatFullName(row.lastName, row.firstName) || "Сотрудник",
      departmentId: row.departmentId,
      startDate:
        typeof row.startDate === "string"
          ? row.startDate.slice(0, 10)
          : String(row.startDate).slice(0, 10),
      endDate:
        typeof row.endDate === "string" ? row.endDate.slice(0, 10) : String(row.endDate).slice(0, 10),
    }))

    return NextResponse.json({ month, items })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить календарь отпусков" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
