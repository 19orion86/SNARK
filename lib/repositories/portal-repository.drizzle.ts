import "server-only"
import { and, count, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { mapContactsData } from "@/lib/mappers/portal"
import { mockPortalRepository } from "@/lib/repositories/portal-repository.mock"
import type { PortalRepository } from "@/lib/repositories/portal-repository.types"
import type { Employee, EmployeesQuery } from "@/types/portal"

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function roleToPosition(role: string): string {
  if (role === "admin") return "Администратор"
  if (role === "hr_manager") return "HR менеджер"
  return "Сотрудник"
}

function mapEmployee(
  row: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
    departmentId: string | null
    isActive: boolean
  },
  fallbackId: number
): Employee {
  return {
    id: fallbackId,
    name: `${row.firstName} ${row.lastName}`.trim(),
    position: roleToPosition(row.role),
    department: row.departmentId ?? "Без отдела",
    phone: "Не указан",
    email: row.email,
    office: "Не указан",
    status: row.isActive ? "online" : "offline",
    avatar: initials(row.firstName, row.lastName),
  }
}

export const drizzlePortalRepository: PortalRepository = {
  getDashboardData: mockPortalRepository.getDashboardData,
  getDocumentsData: mockPortalRepository.getDocumentsData,
  getProfileData: mockPortalRepository.getProfileData,
  getSidebarItems: mockPortalRepository.getSidebarItems,

  async getContactsData(query?: EmployeesQuery) {
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const offset = (page - 1) * limit

    const where = and(
      query?.department && query.department !== "Все"
        ? eq(users.departmentId, query.department)
        : undefined,
      query?.search
        ? or(
            ilike(users.firstName, `%${query.search}%`),
            ilike(users.lastName, `%${query.search}%`),
            ilike(users.email, `%${query.search}%`)
          )
        : undefined
    )

    const [totalRow] = await db.select({ value: count() }).from(users).where(where)

    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        departmentId: users.departmentId,
        isActive: users.isActive,
      })
      .from(users)
      .where(where)
      .orderBy(sql`${users.lastName} asc, ${users.firstName} asc`)
      .limit(limit)
      .offset(offset)

    const departmentsRows = await db.selectDistinct({ departmentId: users.departmentId }).from(users)

    const departments = [
      "Все",
      ...departmentsRows
        .map((row) => row.departmentId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ]

    const employees = rows.map((row, idx) => mapEmployee(row, offset + idx + 1))

    return mapContactsData({
      employees,
      departments,
      total: Number(totalRow?.value ?? 0),
      page,
      limit,
    })
  },
}
