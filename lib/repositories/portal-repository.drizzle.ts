import "server-only"
import { and, asc, count, desc, eq, gte, ilike, isNotNull, lt, ne, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "@/lib/db/client"
import {
  departments,
  documents,
  employeeProfiles,
  events,
  knowledgeArticles,
  news,
  orgImportRuns,
  tickets,
  ticketCategories,
  users,
  vacations,
} from "@/lib/db/schema"
import { hashPassword } from "@/lib/auth/password"
import { revokeAllRefreshTokensForUser } from "@/lib/auth/session"
import { formatFullName, formatInitials } from "@/lib/portal-data/format-name"
import { buildOrgStructureImportPreview } from "@/lib/import/org-structure-diff"
import {
  fuzzyMatchDepartment,
  normalizeDepartmentKey,
  type ParsedOrgStructure,
} from "@/lib/import/one-c-staffing-parser"
import { mapContactsData, mapDocumentsData, mapProfileData } from "@/lib/mappers/portal"
import { mockPortalRepository } from "@/lib/repositories/portal-repository.mock"
import { listMyDashboardTasks } from "@/lib/repositories/tasks.repository"
import type { PortalRepository } from "@/lib/repositories/portal-repository.types"
import type {
  AdminDepartmentItem,
  AdminDepartmentUpsertPayload,
  AdminDepartmentsResponse,
  AdminEmployeeItem,
  AdminEmployeeUpsertPayload,
  AdminEmployeesResponse,
  AdminPortalUserCreatePayload,
  AdminPortalUserItem,
  AdminPortalUsersResponse,
  AdminVacationItem,
  BirthdayPerson,
  BirthdaysData,
  CalendarEvent,
  DepartmentTreeNode,
  DepartmentsTreeResponse,
  DocumentMetadataCreatePayload,
  DocumentsData,
  DocumentsQuery,
  Employee,
  EmployeeImportResult,
  EmployeesQuery,
  EventCategory,
  EventCreatePayload,
  EventsListResponse,
  EventsMonthQuery,
  OrgStructureImportOptions,
  OrgStructureImportPreview,
  OrgStructureImportResult,
  KnowledgeArticle,
  KnowledgeCategory,
  KnowledgeDetailResponse,
  KnowledgeEditorPayload,
  KnowledgeListQuery,
  KnowledgeListResponse,
  NewEmployeeItem,
  NewsDetailResponse,
  NewsEditorPayload,
  NewsListQuery,
  NewsListResponse,
  ProfileData,
  ProfilePresenceUpdatePayload,
  ProfileUpdatePayload,
  Ticket,
  TicketAdminUpdatePayload,
  TicketCategoriesResponse,
  TicketCategoryItem,
  TicketCategoryUpsertPayload,
  TicketCreatePayload,
  TicketPriority,
  TicketStatus,
  TicketsListResponse,
  TicketsQuery,
  VacationAdminUpdatePayload,
  VacationBalance,
  VacationCreatePayload,
  VacationItem,
  VacationStatus,
  VacationType,
} from "@/types/portal"
import type { UserRole } from "@/types/auth"

function initials(firstName: string, lastName: string): string {
  return formatInitials(lastName, firstName)
}

function roleToPosition(role: string): string {
  if (role === "admin") return "Администратор"
  if (role === "hr_manager") return "HR менеджер"
  return "Сотрудник"
}

function parseFullName(fullName: string): { firstName: string; lastName: string; middleName: string | null } {
  const cleaned = fullName.replace(/\s+/g, " ").trim()
  const [lastName = "", firstName = "", ...rest] = cleaned.split(" ")
  return {
    firstName: firstName || "Неизвестно",
    lastName: lastName || "Неизвестно",
    middleName: rest.length > 0 ? rest.join(" ") : null,
  }
}

function employeeNameKey(parts: {
  lastName: string
  firstName: string
  middleName: string | null
}): string {
  return normalizeDepartmentKey(
    [parts.lastName, parts.firstName, parts.middleName].filter(Boolean).join(" ")
  )
}

function resolveDepartmentId(
  departmentName: string,
  departments: AdminDepartmentItem[]
): string | null {
  const direct = departments.find(
    (dept) => normalizeDepartmentKey(dept.name) === normalizeDepartmentKey(departmentName)
  )
  if (direct) return direct.id

  const matchedName = fuzzyMatchDepartment(
    departmentName,
    new Set(departments.map((dept) => dept.name))
  )
  if (!matchedName) return null
  return departments.find((dept) => dept.name === matchedName)?.id ?? null
}

function mapStatusToPresence(status: AdminEmployeeUpsertPayload["status"]): string {
  if (status === "vacation") return "away"
  if (status === "remote") return "offline"
  return "office"
}

function mapRowToAdminStatus(isActive: boolean, presence: string | null): AdminEmployeeItem["status"] {
  if (!isActive) return "dismissed"
  if (presence === "away") return "vacation"
  if (presence === "offline") return "remote"
  return "active"
}

function mapNewsCategory(value: string): "company" | "projects" | "people" | "important" {
  if (value === "projects" || value === "people" || value === "important") return value
  return "company"
}

function mapPresenceFromLegacy(value: string | null | undefined): "office" | "remote" | "vacation" {
  if (value === "offline") return "remote"
  if (value === "away") return "vacation"
  return "office"
}

function mapPresenceToLegacy(value: ProfilePresenceUpdatePayload["presence"]): "office" | "offline" | "away" {
  if (value === "remote") return "offline"
  if (value === "vacation") return "away"
  return "office"
}

function generatePlaceholderEmail(): string {
  return `imported.${crypto.randomUUID().slice(0, 8)}@imported.local`
}

function buildEmployeeProfileFields(
  userId: string,
  payload: AdminEmployeeUpsertPayload,
  middleName: string | null,
  now: Date
) {
  return {
    userId,
    middleName,
    phone: payload.phone?.trim() || null,
    positionTitle: payload.positionTitle.trim(),
    presence: mapStatusToPresence(payload.status),
    birthDate: payload.birthDate || null,
    startDate: payload.startDate || null,
    welcomeNote: payload.welcomeNote?.trim() || null,
    inn: payload.inn?.trim() || null,
    snils: payload.snils?.trim() || null,
    address: payload.address?.trim() || null,
    citizenship: payload.citizenship?.trim() || null,
    anniversaryYears: payload.anniversaryYears ?? null,
    professions: payload.professions?.trim() || null,
    education: payload.education?.trim() || null,
    managerPosition: payload.managerPosition?.trim() || null,
    contractEndDate: payload.contractEndDate || null,
    isContractor: payload.isContractor ?? false,
    updatedAt: now,
  }
}

async function getOrCreateDepartmentIdByName(
  rawName: string,
  options?: { code?: string; contactEmail?: string }
): Promise<string | null> {
  const name = rawName.trim()
  if (!name) return null
  const code = options?.code?.trim() || undefined
  const contactEmail = options?.contactEmail?.trim().toLowerCase() || undefined
  const [existing] = await db.select({ id: departments.id }).from(departments).where(eq(departments.name, name)).limit(1)
  if (existing) {
    if (code || contactEmail) {
      await db
        .update(departments)
        .set({
          ...(code ? { code } : {}),
          ...(contactEmail ? { contactEmail } : {}),
        })
        .where(eq(departments.id, existing.id))
    }
    return existing.id
  }
  const [created] = await db
    .insert(departments)
    .values({
      name,
      code: code ?? null,
      contactEmail: contactEmail ?? null,
    })
    .returning({ id: departments.id })
  return created?.id ?? null
}

const NEW_EMPLOYEE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000

function isNewEmployee(
  welcomeNote: string | null | undefined,
  startDate: string | null | undefined,
  createdAt: Date | string | null | undefined
): boolean {
  const trimmed = welcomeNote?.trim() ?? ""
  if (trimmed.length === 0) return false

  const source =
    startDate ??
    (createdAt instanceof Date
      ? createdAt.toISOString().slice(0, 10)
      : typeof createdAt === "string"
        ? createdAt
        : null)
  if (!source) return false

  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return false
  return Date.now() - date.getTime() <= NEW_EMPLOYEE_WINDOW_MS
}

function presenceToStatus(presence: string | null | undefined): Employee["status"] {
  const mapped = mapPresenceFromLegacy(presence)
  if (mapped === "office") return "online"
  if (mapped === "vacation") return "away"
  return "offline"
}

interface EmployeeRow {
  id: string
  firstName: string
  lastName: string
  middleName?: string | null
  email: string
  isActive: boolean
  createdAt: Date | string | null
  phone: string | null
  positionTitle: string | null
  avatarUrl: string | null
  presence: string | null
  office: string | null
  departmentName: string | null
  inn: string | null
  snils: string | null
  birthDate: string | null
  address: string | null
  citizenship: string | null
  anniversaryYears: number | null
  professions: string | null
  education: string | null
  managerPosition: string | null
  contractEndDate: string | null
  isContractor: boolean | null
  startDate: string | null
  welcomeNote: string | null
}

function mapRowToEmployee(row: EmployeeRow, listId: number): Employee {
  return {
    id: listId,
    userId: row.id,
    name: formatFullName(row.lastName, row.firstName, row.middleName),
    position: row.positionTitle ?? "Сотрудник",
    department: row.departmentName ?? "Без отдела",
    phone: row.phone ?? "Не указан",
    email: row.email,
    office: row.office ?? "Не указан",
    status: row.isActive ? presenceToStatus(row.presence) : "offline",
    avatar: formatInitials(row.lastName, row.firstName),
    avatarUrl: row.avatarUrl ?? undefined,
    inn: row.inn,
    snils: row.snils,
    birthDate: row.birthDate,
    address: row.address,
    citizenship: row.citizenship,
    anniversaryYears: row.anniversaryYears,
    professions: row.professions,
    education: row.education,
    managerPosition: row.managerPosition,
    contractEndDate: row.contractEndDate,
    isContractor: row.isContractor ?? false,
    hireDate: row.startDate,
    welcomeText: row.welcomeNote,
    isNew: isNewEmployee(row.welcomeNote, row.startDate, row.createdAt),
  }
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function daysUntilNextBirthday(birthDate: Date, today: Date): number {
  const todayStart = startOfDay(today)
  const next = new Date(todayStart.getFullYear(), birthDate.getMonth(), birthDate.getDate())
  if (next.getTime() < todayStart.getTime()) {
    next.setFullYear(todayStart.getFullYear() + 1)
  }
  return Math.round((next.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))
}

function ageOnNextBirthday(birthDate: Date, today: Date): number {
  const todayStart = startOfDay(today)
  const nextBirthdayYear =
    new Date(todayStart.getFullYear(), birthDate.getMonth(), birthDate.getDate()).getTime() < todayStart.getTime()
      ? todayStart.getFullYear() + 1
      : todayStart.getFullYear()
  return nextBirthdayYear - birthDate.getFullYear()
}

function ageNow(birthDate: Date, today: Date): number {
  let age = today.getFullYear() - birthDate.getFullYear()
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  if (beforeBirthday) age -= 1
  return Math.max(age, 0)
}

type AdminPortalUserRow = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  isActive: boolean
  createdAt: Date
  lastLoginAt: Date | null
  departmentName: string | null
}

function mapAdminPortalUserRow(row: AdminPortalUserRow): AdminPortalUserItem {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
    isActive: row.isActive,
    departmentName: row.departmentName,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
  }
}

async function selectAdminPortalUserById(id: string): Promise<AdminPortalUserItem | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.id, id))
    .limit(1)

  if (!row) return null
  return mapAdminPortalUserRow(row as AdminPortalUserRow)
}

export const drizzlePortalRepository: PortalRepository = {
  async getBirthdays(): Promise<BirthdaysData> {
    const today = new Date()

    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        positionTitle: employeeProfiles.positionTitle,
        avatarUrl: employeeProfiles.avatarUrl,
        departmentName: departments.name,
        birthDate: employeeProfiles.birthDate,
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(and(eq(users.isActive, true), isNotNull(employeeProfiles.birthDate)))

    const buckets: BirthdaysData = { today: [], thisWeek: [], upcoming: [] }

    for (const row of rows) {
      if (!row.birthDate) continue
      const birthDate = new Date(row.birthDate)
      if (Number.isNaN(birthDate.getTime())) continue

      const daysUntil = daysUntilNextBirthday(birthDate, today)
      const isToday =
        birthDate.getMonth() === today.getMonth() && birthDate.getDate() === today.getDate()

      const person: BirthdayPerson = {
        id: row.id,
        name: `${row.firstName} ${row.lastName}`.trim(),
        department: row.departmentName ?? "Без отдела",
        position: row.positionTitle ?? "Сотрудник",
        avatar: `${row.firstName.charAt(0)}${row.lastName.charAt(0)}`.toUpperCase(),
        avatarUrl: row.avatarUrl ?? null,
        birthDate: row.birthDate,
        age: isToday ? ageNow(birthDate, today) : ageOnNextBirthday(birthDate, today),
      }

      if (isToday) {
        buckets.today.push(person)
      } else if (daysUntil >= 1 && daysUntil <= 7) {
        buckets.thisWeek.push(person)
      } else if (daysUntil >= 8 && daysUntil <= 30) {
        buckets.upcoming.push(person)
      }
    }

    const byDaysUntil = (a: BirthdayPerson, b: BirthdayPerson) =>
      daysUntilNextBirthday(new Date(a.birthDate), today) -
      daysUntilNextBirthday(new Date(b.birthDate), today)

    buckets.today.sort((a, b) => a.name.localeCompare(b.name, "ru"))
    buckets.thisWeek.sort(byDaysUntil)
    buckets.upcoming.sort(byDaysUntil)

    return buckets
  },

  async getNewEmployees(): Promise<NewEmployeeItem[]> {
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        positionTitle: employeeProfiles.positionTitle,
        avatarUrl: employeeProfiles.avatarUrl,
        departmentName: departments.name,
        startDate: employeeProfiles.startDate,
        welcomeNote: employeeProfiles.welcomeNote,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(
        and(
          eq(users.isActive, true),
          isNotNull(employeeProfiles.welcomeNote),
          sql`length(trim(${employeeProfiles.welcomeNote})) > 0`,
          sql`COALESCE(${employeeProfiles.startDate}::date, ${users.createdAt}::date) >= (now() - interval '60 days')::date`
        )
      )
      .orderBy(
        desc(sql`COALESCE(${employeeProfiles.startDate}, ${users.createdAt})`)
      )
      .limit(10)

    return rows.map((row) => {
      const startDate = row.startDate ?? row.createdAt.toISOString().slice(0, 10)
      const welcomeText = row.welcomeNote?.trim() ?? ""
      return {
        id: row.id,
        name: `${row.firstName} ${row.lastName}`.trim(),
        position: row.positionTitle ?? "Сотрудник",
        department: row.departmentName ?? "Без отдела",
        avatar: initials(row.firstName, row.lastName),
        avatarUrl: row.avatarUrl ?? null,
        startDate,
        welcomeText: welcomeText.length > 0 ? welcomeText : null,
      }
    })
  },

  async getDashboardData(userId?: string) {
    const birthdays = await this.getBirthdays()
    const newEmployees = await this.getNewEmployees()

    const recentNewsRows = await db
      .select({
        id: news.id,
        title: news.title,
        category: news.category,
        isPinned: news.isPinned,
        publishedAt: news.publishedAt,
        createdAt: news.createdAt,
      })
      .from(news)
      .where(eq(news.status, "published"))
      .orderBy(desc(news.isPinned), desc(news.publishedAt), desc(news.createdAt))
      .limit(5)

    const fallback = await mockPortalRepository.getDashboardData(userId)

    let welcomeName = fallback.welcomeName
    if (userId) {
      const [user] = await db
        .select({ firstName: users.firstName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      const name = user?.firstName?.trim()
      if (name) welcomeName = name
    }

    return {
      ...fallback,
      welcomeName,
      birthdays,
      newEmployees,
      myTasks: userId ? await listMyDashboardTasks(userId) : fallback.myTasks,
      recentNews: recentNewsRows.map((row) => ({
        id: row.id,
        title: row.title,
        body: "",
        category: mapNewsCategory(row.category),
        coverUrl: null,
        isPinned: row.isPinned,
        status: "published" as const,
        authorId: null,
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.createdAt.toISOString(),
      })),
    }
  },
  getSidebarItems: mockPortalRepository.getSidebarItems,

  async getContactsData(query?: EmployeesQuery) {
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const offset = (page - 1) * limit

    // Фильтр: поиск по имени/email, фильтр по НАЗВАНИЮ отдела (не UUID)
    const where = and(
      query?.department && query.department !== "Все"
        ? eq(departments.name, query.department)
        : undefined,
      query?.search
        ? or(
            ilike(users.firstName, `%${query.search}%`),
            ilike(users.lastName, `%${query.search}%`),
            ilike(users.email, `%${query.search}%`),
            ilike(employeeProfiles.positionTitle, `%${query.search}%`)
          )
        : undefined,
      eq(users.isActive, true)
    )

    // Считать total с JOIN
    const [totalRow] = await db
      .select({ value: count() })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(where)

    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        middleName: employeeProfiles.middleName,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        phone: employeeProfiles.phone,
        positionTitle: employeeProfiles.positionTitle,
        avatarUrl: employeeProfiles.avatarUrl,
        presence: employeeProfiles.presence,
        office: employeeProfiles.office,
        departmentName: departments.name,
        inn: employeeProfiles.inn,
        snils: employeeProfiles.snils,
        birthDate: employeeProfiles.birthDate,
        address: employeeProfiles.address,
        citizenship: employeeProfiles.citizenship,
        anniversaryYears: employeeProfiles.anniversaryYears,
        professions: employeeProfiles.professions,
        education: employeeProfiles.education,
        managerPosition: employeeProfiles.managerPosition,
        contractEndDate: employeeProfiles.contractEndDate,
        isContractor: employeeProfiles.isContractor,
        startDate: employeeProfiles.startDate,
        welcomeNote: employeeProfiles.welcomeNote,
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(where)
      .orderBy(sql`${users.lastName} asc, ${users.firstName} asc`)
      .limit(limit)
      .offset(offset)

    const deptList = await db
      .selectDistinct({ name: departments.name })
      .from(departments)
      .where(isNotNull(departments.name))

    const departmentNames = [
      "Все",
      ...deptList.map((d) => d.name).filter((n): n is string => !!n),
    ]

    const employees: Employee[] = rows.map((row, idx) => mapRowToEmployee(row, offset + idx + 1))

    return mapContactsData({
      employees,
      departments: departmentNames,
      total: Number(totalRow?.value ?? 0),
      page,
      limit,
    })
  },

  async getEmployeeById(id: string): Promise<{ item: Employee | null }> {
    const [row] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        middleName: employeeProfiles.middleName,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        phone: employeeProfiles.phone,
        positionTitle: employeeProfiles.positionTitle,
        avatarUrl: employeeProfiles.avatarUrl,
        presence: employeeProfiles.presence,
        office: employeeProfiles.office,
        departmentName: departments.name,
        departmentId: departments.id,
        departmentHeadUserId: departments.headUserId,
        inn: employeeProfiles.inn,
        snils: employeeProfiles.snils,
        birthDate: employeeProfiles.birthDate,
        address: employeeProfiles.address,
        citizenship: employeeProfiles.citizenship,
        anniversaryYears: employeeProfiles.anniversaryYears,
        professions: employeeProfiles.professions,
        education: employeeProfiles.education,
        managerPosition: employeeProfiles.managerPosition,
        contractEndDate: employeeProfiles.contractEndDate,
        isContractor: employeeProfiles.isContractor,
        startDate: employeeProfiles.startDate,
        welcomeNote: employeeProfiles.welcomeNote,
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(eq(users.id, id))
      .limit(1)

    if (!row) return { item: null }
    const employee = mapRowToEmployee(row, 0)

    if (row.departmentHeadUserId && row.departmentHeadUserId !== row.id) {
      const [headRow] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          middleName: employeeProfiles.middleName,
          positionTitle: employeeProfiles.positionTitle,
        })
        .from(users)
        .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
        .where(eq(users.id, row.departmentHeadUserId))
        .limit(1)

      if (headRow) {
        const fullName = [headRow.lastName, headRow.firstName, headRow.middleName]
          .filter(Boolean)
          .join(" ")
          .trim()
        employee.manager = {
          id: headRow.id,
          fullName,
          positionTitle: headRow.positionTitle,
        }
      } else {
        employee.manager = null
      }
    } else {
      employee.manager = null
    }

    return { item: employee }
  },

  async getDepartmentsTree(): Promise<DepartmentsTreeResponse> {
    const rows = await db
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
        description: departments.description,
        parentId: departments.parentId,
        plannedHeadcount: departments.plannedHeadcount,
        headUserId: departments.headUserId,
        headFirstName: users.firstName,
        headLastName: users.lastName,
        headMiddleName: employeeProfiles.middleName,
        headPositionTitle: employeeProfiles.positionTitle,
        headAvatarUrl: employeeProfiles.avatarUrl,
      })
      .from(departments)
      .leftJoin(users, eq(users.id, departments.headUserId))
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, departments.headUserId))
      .where(eq(departments.isArchived, false))

    const counts = await db
      .select({ departmentId: users.departmentId, value: count() })
      .from(users)
      .where(and(isNotNull(users.departmentId), eq(users.isActive, true)))
      .groupBy(users.departmentId)

    const countByDept = new Map<string, number>()
    for (const c of counts) {
      if (c.departmentId) countByDept.set(c.departmentId, Number(c.value))
    }

    const nodeById = new Map<string, DepartmentTreeNode & { parentId: string | null }>()
    for (const row of rows) {
      const headFullName = row.headUserId
        ? [row.headLastName, row.headFirstName, row.headMiddleName].filter(Boolean).join(" ").trim()
        : ""

      nodeById.set(row.id, {
        id: row.id,
        name: row.name,
        code: row.code,
        description: row.description,
        head:
          row.headUserId && headFullName
            ? {
                id: row.headUserId,
                fullName: headFullName,
                positionTitle: row.headPositionTitle,
                avatarUrl: row.headAvatarUrl,
              }
            : null,
        employeeCount: countByDept.get(row.id) ?? 0,
        plannedHeadcount: row.plannedHeadcount ?? null,
        children: [],
        parentId: row.parentId,
      })
    }

    const roots: DepartmentTreeNode[] = []
    for (const node of nodeById.values()) {
      if (node.parentId && nodeById.has(node.parentId)) {
        nodeById.get(node.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    const sortRecursive = (list: DepartmentTreeNode[]) => {
      list.sort((a, b) => a.name.localeCompare(b.name, "ru"))
      for (const item of list) sortRecursive(item.children)
    }
    sortRecursive(roots)

    const strip = (node: DepartmentTreeNode & { parentId?: string | null }): DepartmentTreeNode => {
      const { parentId: _parentId, children, ...rest } = node
      return { ...rest, children: children.map(strip) }
    }

    return { departments: roots.map(strip) }
  },

  async getDocumentsData(
    query?: DocumentsQuery,
    requester?: { role: string; userId?: string; departmentId?: string | null }
  ) {
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const offset = (page - 1) * limit
    const isPrivileged = requester?.role === "admin" || requester?.role === "hr_manager"
    let requesterDepartment = requester?.departmentId ?? null
    if (!requesterDepartment && requester?.userId) {
      const [requesterRow] = await db
        .select({ departmentId: users.departmentId })
        .from(users)
        .where(eq(users.id, requester.userId))
      requesterDepartment = requesterRow?.departmentId ?? null
    }

    const where = and(
      query?.category && query.category !== "Все" ? eq(documents.category, query.category) : undefined,
      query?.search ? ilike(documents.title, `%${query.search}%`) : undefined,
      !isPrivileged
        ? or(eq(documents.access, "public"), eq(documents.departmentId, requesterDepartment ?? ""))
        : undefined
    )

    const [totalRow] = await db.select({ value: count() }).from(documents).where(where)

    const rows = await db
      .select({
        id: documents.id,
        title: documents.title,
        category: documents.category,
        version: documents.version,
        fileName: documents.fileName,
        contentType: documents.contentType,
        sizeBytes: documents.sizeBytes,
        access: documents.access,
        departmentId: documents.departmentId,
        ownerLabel: documents.ownerLabel,
        filePath: documents.filePath,
        createdBy: documents.createdBy,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(where)
      .orderBy(sql`${documents.createdAt} desc`)
      .limit(limit)
      .offset(offset)

    const categoriesRows = await db.selectDistinct({ category: documents.category }).from(documents)

    return mapDocumentsData({
      categories: ["Все", ...categoriesRows.map((row) => row.category)],
      documents: rows.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        date: row.createdAt.toLocaleDateString("ru-RU"),
        version: row.version,
        size: `${(row.sizeBytes / 1024 / 1024).toFixed(1)} МБ`,
        owner: row.ownerLabel ?? "Не указан",
        access: row.access === "public" ? "public" : "restricted",
        departmentId: row.departmentId,
        fileName: row.fileName,
        fileUrl: row.filePath ?? undefined,
        mimeType: row.contentType,
        createdBy: row.createdBy ?? undefined,
      })),
      total: Number(totalRow?.value ?? 0),
      page,
      limit,
    })
  },

  async getDocumentById(id: string) {
    const [row] = await db
      .select({
        id: documents.id,
        title: documents.title,
        category: documents.category,
        version: documents.version,
        fileName: documents.fileName,
        contentType: documents.contentType,
        sizeBytes: documents.sizeBytes,
        access: documents.access,
        departmentId: documents.departmentId,
        ownerLabel: documents.ownerLabel,
        filePath: documents.filePath,
        createdBy: documents.createdBy,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.id, id))

    if (!row) return { item: null }

    return {
      item: {
        id: row.id,
        title: row.title,
        category: row.category,
        date: row.createdAt.toLocaleDateString("ru-RU"),
        version: row.version,
        size: `${(row.sizeBytes / 1024 / 1024).toFixed(1)} МБ`,
        owner: row.ownerLabel ?? "Не указан",
        access: row.access === "public" ? "public" : "restricted",
        departmentId: row.departmentId,
        fileName: row.fileName,
        fileUrl: row.filePath ?? undefined,
        mimeType: row.contentType,
        createdBy: row.createdBy ?? undefined,
      },
    }
  },

  async createDocumentMetadata(payload: DocumentMetadataCreatePayload & { createdBy: string }) {
    const [created] = await db
      .insert(documents)
      .values({
        title: payload.title,
        category: payload.category,
        version: payload.version ?? "1.0",
        fileName: payload.fileName,
        contentType: payload.contentType,
        sizeBytes: payload.sizeBytes,
        access: payload.access,
        departmentId: payload.departmentId ?? null,
        ownerLabel: "Пользователь",
        createdBy: payload.createdBy,
      })
      .returning({ id: documents.id })

    const objectKey = `documents/${payload.createdBy}/${created.id}/${payload.fileName}`

    // Сохранить objectKey как filePath чтобы потом строить preview URL
    await db
      .update(documents)
      .set({ filePath: objectKey })
      .where(eq(documents.id, created.id))

    return {
      documentId: created.id,
      objectKey,
      uploadUrl: `pending`, // реальный uploadUrl генерируется в API route через getFileStorage()
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }
  },

  async getProfileData(userId?: string): Promise<ProfileData> {
    if (!userId) return mockPortalRepository.getProfileData()
    const profile = await this.getCurrentUserProfile(userId)
    return profile ?? mockPortalRepository.getProfileData()
  },

  async getCurrentUserProfile(userId: string): Promise<ProfileData | null> {
    const [row] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        middleName: employeeProfiles.middleName,
        email: users.email,
        role: users.role,
        departmentId: users.departmentId,
        phone: employeeProfiles.phone,
        avatarUrl: employeeProfiles.avatarUrl,
        positionTitle: employeeProfiles.positionTitle,
        office: employeeProfiles.office,
        presence: employeeProfiles.presence,
        departmentName: departments.name,
        departmentHeadUserId: departments.headUserId,
        regulationsDocId: departments.regulationsDocId,
        standardsDocId: departments.standardsDocId,
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(eq(users.id, userId))

    if (!row) return null

    const [departmentHead] = row.departmentHeadUserId
      ? await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(eq(users.id, row.departmentHeadUserId))
          .limit(1)
      : []

    const [regulationsDoc] = row.regulationsDocId
      ? await db
          .select({
            id: documents.id,
            title: documents.title,
            filePath: documents.filePath,
          })
          .from(documents)
          .where(eq(documents.id, row.regulationsDocId))
          .limit(1)
      : []

    const [standardsDoc] = row.standardsDocId
      ? await db
          .select({
            id: documents.id,
            title: documents.title,
            filePath: documents.filePath,
          })
          .from(documents)
          .where(eq(documents.id, row.standardsDocId))
          .limit(1)
      : []

    const [jobInstruction] =
      row.positionTitle && row.positionTitle.length > 0
        ? await db
            .select({
              id: documents.id,
              title: documents.title,
              filePath: documents.filePath,
            })
            .from(documents)
            .where(and(eq(documents.docType, "job_instruction"), eq(documents.linkedPosition, row.positionTitle)))
            .orderBy(desc(documents.createdAt))
            .limit(1)
        : []

    const allVacations = await db
      .select({
        id: vacations.id,
        userId: vacations.userId,
        startDate: vacations.startDate,
        endDate: vacations.endDate,
        daysTotal: vacations.daysTotal,
        daysRemaining: vacations.daysRemaining,
        status: vacations.status,
        type: vacations.type,
        comment: vacations.comment,
        approvedBy: vacations.approvedBy,
        createdAt: vacations.createdAt,
      })
      .from(vacations)
      .where(eq(vacations.userId, userId))
      .orderBy(desc(vacations.startDate))

    const today = new Date()
    const todayIso = today.toISOString().slice(0, 10)
    const approvedVacations = allVacations.filter((item) => item.status === "approved")
    const nextVacationRaw = approvedVacations
      .filter((item) => item.startDate > todayIso)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    const previousVacations = allVacations
      .slice()
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
    const latestApproved = approvedVacations[0]
    const daysUntil = nextVacationRaw
      ? Math.ceil((new Date(nextVacationRaw.startDate).getTime() - today.getTime()) / 86400000)
      : null

    const fallback = await mockPortalRepository.getProfileData()
    return mapProfileData({
      ...fallback,
      userId: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: formatFullName(row.lastName, row.firstName, row.middleName),
      initials: formatInitials(row.lastName, row.firstName),
      role: row.role as UserRole,
      roleTitle: row.positionTitle ?? fallback.roleTitle,
      positionTitle: row.positionTitle ?? fallback.roleTitle,
      department: row.departmentName ?? fallback.department,
      departmentId: row.departmentId,
      phone: row.phone ?? fallback.phone,
      email: row.email,
      office: row.office ?? fallback.office,
      avatarUrl: row.avatarUrl ?? undefined,
      legacyPresence:
        row.presence === "away" || row.presence === "offline" || row.presence === "office"
          ? row.presence
          : "office",
      presence: mapPresenceFromLegacy(row.presence),
      profileTab: {
        status: mapPresenceFromLegacy(row.presence),
      },
      departmentTab: {
        departmentName: row.departmentName ?? fallback.department,
        manager: departmentHead
          ? {
              id: departmentHead.id,
              fullName: formatFullName(departmentHead.lastName, departmentHead.firstName),
            }
          : null,
        regulationsDoc: regulationsDoc
          ? {
              id: regulationsDoc.id,
              title: regulationsDoc.title,
              downloadUrl: regulationsDoc.filePath ?? undefined,
            }
          : null,
        standardsDoc: standardsDoc
          ? {
              id: standardsDoc.id,
              title: standardsDoc.title,
              downloadUrl: standardsDoc.filePath ?? undefined,
            }
          : null,
      },
      documentsTab: {
        jobInstruction: jobInstruction
          ? {
              id: jobInstruction.id,
              title: jobInstruction.title,
              downloadUrl: jobInstruction.filePath ?? undefined,
            }
          : null,
      },
      vacationTab: {
        daysRemaining: latestApproved?.daysRemaining ?? 0,
        nextVacation: nextVacationRaw
          ? {
              startDate: nextVacationRaw.startDate,
              endDate: nextVacationRaw.endDate,
              daysUntil: daysUntil ?? 0,
            }
          : null,
        history: previousVacations.map(mapVacationRowToItem),
      },
      vacations: allVacations.map(mapVacationRowToItem),
    })
  },

  async updateProfile(userId: string, payload: ProfileUpdatePayload): Promise<ProfileData> {
    const set: {
      updatedAt: Date
      phone?: string | null
      avatarUrl?: string | null
    } = { updatedAt: new Date() }

    if (payload.phone !== undefined) {
      set.phone = payload.phone || null
    }
    if (payload.avatarUrl !== undefined) {
      set.avatarUrl = payload.avatarUrl || null
    }

    if (payload.phone !== undefined || payload.avatarUrl !== undefined) {
      await db
        .insert(employeeProfiles)
        .values({
          userId,
          phone: payload.phone !== undefined ? payload.phone || null : null,
          avatarUrl: payload.avatarUrl !== undefined ? payload.avatarUrl || null : null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: employeeProfiles.userId,
          set,
        })
    }

    const updated = await this.getCurrentUserProfile(userId)
    if (!updated) {
      throw new Error("PROFILE_NOT_FOUND")
    }
    return updated
  },

  async updateMyPresence(userId: string, payload: ProfilePresenceUpdatePayload): Promise<ProfileData> {
    await db
      .insert(employeeProfiles)
      .values({
        userId,
        presence: mapPresenceToLegacy(payload.presence),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: employeeProfiles.userId,
        set: {
          presence: mapPresenceToLegacy(payload.presence),
          updatedAt: new Date(),
        },
      })

    const updated = await this.getCurrentUserProfile(userId)
    if (!updated) {
      throw new Error("PROFILE_NOT_FOUND")
    }
    return updated
  },

  async listAdminEmployees(): Promise<AdminEmployeesResponse> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        departmentId: users.departmentId,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        phone: employeeProfiles.phone,
        positionTitle: employeeProfiles.positionTitle,
        middleName: employeeProfiles.middleName,
        birthDate: employeeProfiles.birthDate,
        startDate: employeeProfiles.startDate,
        welcomeNote: employeeProfiles.welcomeNote,
        presence: employeeProfiles.presence,
        office: employeeProfiles.office,
        departmentName: departments.name,
        inn: employeeProfiles.inn,
        snils: employeeProfiles.snils,
        address: employeeProfiles.address,
        citizenship: employeeProfiles.citizenship,
        anniversaryYears: employeeProfiles.anniversaryYears,
        professions: employeeProfiles.professions,
        education: employeeProfiles.education,
        managerPosition: employeeProfiles.managerPosition,
        contractEndDate: employeeProfiles.contractEndDate,
        isContractor: employeeProfiles.isContractor,
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .orderBy(sql`${users.lastName} asc, ${users.firstName} asc`)

    return {
      items: rows.map((row) => ({
        id: row.id,
        fullName: [row.lastName, row.firstName, row.middleName].filter(Boolean).join(" ").trim(),
        firstName: row.firstName,
        lastName: row.lastName,
        middleName: row.middleName ?? null,
        positionTitle: row.positionTitle ?? roleToPosition("employee"),
        departmentId: row.departmentId,
        departmentName: row.departmentName ?? "Без отдела",
        phone: row.phone,
        email: row.email,
        birthDate: row.birthDate ?? null,
        startDate: row.startDate ?? null,
        welcomeNote: row.welcomeNote,
        status: mapRowToAdminStatus(row.isActive, row.presence),
        isActive: row.isActive,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
        inn: row.inn ?? null,
        snils: row.snils ?? null,
        address: row.address ?? null,
        citizenship: row.citizenship ?? null,
        anniversaryYears: row.anniversaryYears ?? null,
        professions: row.professions ?? null,
        education: row.education ?? null,
        managerPosition: row.managerPosition ?? null,
        contractEndDate: row.contractEndDate ?? null,
        isContractor: row.isContractor ?? false,
        isNew: isNewEmployee(row.welcomeNote, row.startDate, row.createdAt),
      })),
    }
  },

  async createAdminEmployee(payload: AdminEmployeeUpsertPayload): Promise<AdminEmployeeItem> {
    const nameParts = parseFullName(payload.fullName)
    const now = new Date()

    const departmentId = await getOrCreateDepartmentIdByName(payload.departmentName, {
      code: payload.departmentCode,
      contactEmail: payload.departmentEmail,
    })

    const email = (payload.email?.trim().toLowerCase() || generatePlaceholderEmail())
    const passwordHash = await hashPassword(crypto.randomUUID())

    const [createdUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        role: "employee",
        departmentId,
        isActive: payload.status !== "dismissed",
      })
      .returning({ id: users.id })

    if (!createdUser) {
      throw new Error("EMPLOYEE_CREATE_FAILED")
    }

    const profileValues = buildEmployeeProfileFields(createdUser.id, payload, nameParts.middleName, now)
    await db.insert(employeeProfiles).values(profileValues)

    const listed = await this.listAdminEmployees()
    const item = listed.items.find((entry) => entry.id === createdUser.id)
    if (!item) {
      throw new Error("EMPLOYEE_NOT_FOUND")
    }
    return item
  },

  async updateAdminEmployee(id: string, payload: AdminEmployeeUpsertPayload): Promise<AdminEmployeeItem> {
    const nameParts = parseFullName(payload.fullName)
    const now = new Date()

    const departmentId = await getOrCreateDepartmentIdByName(payload.departmentName, {
      code: payload.departmentCode,
      contactEmail: payload.departmentEmail,
    })

    const userUpdate: Record<string, unknown> = {
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      departmentId,
      isActive: payload.status !== "dismissed",
      updatedAt: now,
    }
    if (payload.email?.trim()) {
      userUpdate.email = payload.email.trim().toLowerCase()
    }
    await db.update(users).set(userUpdate).where(eq(users.id, id))

    const profileValues = buildEmployeeProfileFields(id, payload, nameParts.middleName, now)
    const { userId: _userId, ...profileSet } = profileValues
    await db
      .insert(employeeProfiles)
      .values(profileValues)
      .onConflictDoUpdate({
        target: employeeProfiles.userId,
        set: profileSet,
      })

    const listed = await this.listAdminEmployees()
    const item = listed.items.find((entry) => entry.id === id)
    if (!item) {
      throw new Error("EMPLOYEE_NOT_FOUND")
    }
    return item
  },

  async hideAdminEmployee(id: string, hidden: boolean): Promise<AdminEmployeeItem> {
    await db
      .update(users)
      .set({
        isActive: !hidden,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))

    const listed = await this.listAdminEmployees()
    const item = listed.items.find((entry) => entry.id === id)
    if (!item) {
      throw new Error("EMPLOYEE_NOT_FOUND")
    }
    return item
  },

  async deleteAdminEmployee(id: string): Promise<void> {
    // Сначала удалить профиль (cascade должен сработать, но явно надёжнее)
    await db.delete(employeeProfiles).where(eq(employeeProfiles.userId, id))
    await db.delete(users).where(eq(users.id, id))
  },

  async importEmployees(rows: AdminEmployeeUpsertPayload[]): Promise<EmployeeImportResult> {
    let created = 0
    let updated = 0
    const errors: EmployeeImportResult["errors"] = []

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      try {
        const nameParts = parseFullName(row.fullName)
        const departmentName = row.departmentName.trim()
        const now = new Date()

        const departmentId = await getOrCreateDepartmentIdByName(departmentName, {
          code: row.departmentCode,
          contactEmail: row.departmentEmail,
        })

        // Идентификация по ФИО: lastName + firstName + middleName (точное совпадение)
        const middleName = nameParts.middleName
        const middleCondition = middleName
          ? eq(employeeProfiles.middleName, middleName)
          : sql`${employeeProfiles.middleName} IS NULL`

        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
          .where(
            and(eq(users.lastName, nameParts.lastName), eq(users.firstName, nameParts.firstName), middleCondition)
          )
          .limit(1)

        let userId = existing?.id
        if (existing) {
          const userUpdate: Record<string, unknown> = {
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            departmentId,
            isActive: row.status !== "dismissed",
            updatedAt: now,
          }
          if (row.email?.trim()) {
            userUpdate.email = row.email.trim().toLowerCase()
          }
          await db.update(users).set(userUpdate).where(eq(users.id, existing.id))
          updated += 1
        } else {
          const email = row.email?.trim().toLowerCase() || generatePlaceholderEmail()
          const passwordHash = await hashPassword(crypto.randomUUID())
          const [createdUser] = await db
            .insert(users)
            .values({
              email,
              passwordHash,
              firstName: nameParts.firstName,
              lastName: nameParts.lastName,
              role: "employee",
              departmentId,
              isActive: row.status !== "dismissed",
            })
            .returning({ id: users.id })
          userId = createdUser.id
          created += 1
        }

        if (!userId) {
          throw new Error("Не удалось определить пользователя")
        }

        const profileValues = buildEmployeeProfileFields(userId, row, nameParts.middleName, now)
        const { userId: _userId, ...profileSet } = profileValues
        await db
          .insert(employeeProfiles)
          .values(profileValues)
          .onConflictDoUpdate({
            target: employeeProfiles.userId,
            set: profileSet,
          })
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Неизвестная ошибка импорта"
        errors.push({ row: index + 2, reason })
      }
    }

    return { created, updated, errors }
  },

  async getNewsList(query?: NewsListQuery, includeDrafts = false): Promise<NewsListResponse> {
    const page = query?.page ?? 1
    const limit = query?.limit ?? 10
    const offset = (page - 1) * limit
    const filterCategory = query?.category && query.category !== "all" ? query.category : undefined

    const where = and(
      !includeDrafts ? eq(news.status, "published") : undefined,
      filterCategory ? eq(news.category, filterCategory) : undefined
    )

    const [totalRow] = await db.select({ value: count() }).from(news).where(where)
    const rows = await db
      .select({
        id: news.id,
        title: news.title,
        body: news.body,
        category: news.category,
        coverUrl: news.coverUrl,
        isPinned: news.isPinned,
        status: news.status,
        authorId: news.authorId,
        publishedAt: news.publishedAt,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .where(where)
      .orderBy(desc(news.isPinned), desc(news.publishedAt), desc(news.createdAt))
      .limit(limit)
      .offset(offset)

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        category: mapNewsCategory(row.category),
        coverUrl: row.coverUrl ?? null,
        isPinned: row.isPinned,
        status: row.status === "published" ? "published" : "draft",
        authorId: row.authorId ?? null,
        authorName: `${row.authorLastName ?? ""} ${row.authorFirstName ?? ""}`.trim() || "Не указан",
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      total: Number(totalRow?.value ?? 0),
      page,
      limit,
    }
  },

  async getNewsById(id: string, includeDrafts = false): Promise<NewsDetailResponse> {
    const where = and(eq(news.id, id), !includeDrafts ? eq(news.status, "published") : undefined)
    const [row] = await db
      .select({
        id: news.id,
        title: news.title,
        body: news.body,
        category: news.category,
        coverUrl: news.coverUrl,
        isPinned: news.isPinned,
        status: news.status,
        authorId: news.authorId,
        publishedAt: news.publishedAt,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(news)
      .leftJoin(users, eq(news.authorId, users.id))
      .where(where)
      .limit(1)

    if (!row) return { item: null }

    return {
      item: {
        id: row.id,
        title: row.title,
        body: row.body,
        category: mapNewsCategory(row.category),
        coverUrl: row.coverUrl ?? null,
        isPinned: row.isPinned,
        status: row.status === "published" ? "published" : "draft",
        authorId: row.authorId ?? null,
        authorName: `${row.authorLastName ?? ""} ${row.authorFirstName ?? ""}`.trim() || "Не указан",
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    }
  },

  async createNews(payload: NewsEditorPayload & { authorId: string }) {
    const [created] = await db
      .insert(news)
      .values({
        title: payload.title,
        body: payload.body,
        category: payload.category,
        coverUrl: payload.coverUrl ?? null,
        isPinned: payload.isPinned ?? false,
        status: payload.status ?? "draft",
        authorId: payload.authorId,
        publishedAt:
          payload.status === "published"
            ? payload.publishedAt
              ? new Date(payload.publishedAt)
              : new Date()
            : null,
      })
      .returning({ id: news.id })

    const detail = await this.getNewsById(created.id, true)
    return detail.item
  },

  async updateNews(id: string, payload: NewsEditorPayload) {
    await db
      .update(news)
      .set({
        title: payload.title,
        body: payload.body,
        category: payload.category,
        coverUrl: payload.coverUrl ?? null,
        isPinned: payload.isPinned ?? false,
        status: payload.status ?? "draft",
        publishedAt:
          payload.status === "published"
            ? payload.publishedAt
              ? new Date(payload.publishedAt)
              : new Date()
            : null,
        updatedAt: new Date(),
      })
      .where(eq(news.id, id))
    const detail = await this.getNewsById(id, true)
    return detail.item
  },

  async deleteNews(id: string): Promise<void> {
    await db.delete(news).where(eq(news.id, id))
  },

  async listMyTickets(authorId: string, query?: TicketsQuery): Promise<TicketsListResponse> {
    return listTicketsInternal({ ownerId: authorId, query })
  },

  async listAdminTickets(query?: TicketsQuery): Promise<TicketsListResponse> {
    return listTicketsInternal({ ownerId: null, query })
  },

  async getTicketById(
    id: string,
    requester: { userId: string; role: UserRole }
  ): Promise<{ item: Ticket | null }> {
    const row = await selectTicketRow(id)
    if (!row) return { item: null }
    if (requester.role !== "admin" && row.authorId !== requester.userId) {
      return { item: null }
    }
    return { item: mapTicketRow(row) }
  },

  async createTicket(payload: TicketCreatePayload & { authorId: string }): Promise<Ticket> {
    const [created] = await db
      .insert(tickets)
      .values({
        authorId: payload.authorId,
        category: payload.category,
        subject: payload.subject,
        description: payload.description ?? null,
        priority: payload.priority,
        status: "new",
      })
      .returning({ id: tickets.id })

    const row = await selectTicketRow(created.id)
    if (!row) {
      throw new Error("Не удалось получить созданную заявку")
    }
    return mapTicketRow(row)
  },

  async updateAdminTicket(id: string, payload: TicketAdminUpdatePayload): Promise<Ticket> {
    const existing = await selectTicketRow(id)
    if (!existing) {
      throw new Error("Заявка не найдена")
    }

    const nextStatus: TicketStatus = (payload.status ?? (existing.status as TicketStatus))
    const previousStatus = existing.status as TicketStatus

    const updateSet: {
      status?: TicketStatus
      assigneeId?: string | null
      resolvedAt?: Date | null
      updatedAt: Date
    } = { updatedAt: new Date() }

    if (payload.status !== undefined) {
      updateSet.status = payload.status
      if (payload.status === "resolved" && previousStatus !== "resolved") {
        updateSet.resolvedAt = new Date()
      } else if (payload.status !== "resolved" && existing.resolvedAt) {
        updateSet.resolvedAt = null
      }
    }

    if (payload.assigneeId !== undefined) {
      updateSet.assigneeId = payload.assigneeId
    }

    void nextStatus

    await db.update(tickets).set(updateSet).where(eq(tickets.id, id))

    const row = await selectTicketRow(id)
    if (!row) {
      throw new Error("Не удалось получить обновлённую заявку")
    }
    return mapTicketRow(row)
  },

  async listMyVacations(userId: string): Promise<VacationItem[]> {
    const rows = await db
      .select({
        id: vacations.id,
        userId: vacations.userId,
        startDate: vacations.startDate,
        endDate: vacations.endDate,
        daysTotal: vacations.daysTotal,
        daysRemaining: vacations.daysRemaining,
        status: vacations.status,
        type: vacations.type,
        comment: vacations.comment,
        approvedBy: vacations.approvedBy,
        createdAt: vacations.createdAt,
      })
      .from(vacations)
      .where(eq(vacations.userId, userId))
      .orderBy(desc(vacations.startDate))

    return rows.map(mapVacationRowToItem)
  },

  async getMyVacationBalance(userId: string): Promise<VacationBalance> {
    const [profile] = await db
      .select({ annualLeaveDays: employeeProfiles.annualLeaveDays })
      .from(employeeProfiles)
      .where(eq(employeeProfiles.userId, userId))
      .limit(1)

    const annual = profile?.annualLeaveDays ?? 28
    const year = new Date().getFullYear()

    const [usedRow] = await db
      .select({ value: sql<number>`COALESCE(SUM(${vacations.daysTotal}), 0)` })
      .from(vacations)
      .where(
        and(
          eq(vacations.userId, userId),
          eq(vacations.status, "approved"),
          eq(vacations.type, "annual"),
          sql`EXTRACT(YEAR FROM ${vacations.startDate}) = ${year}`
        )
      )

    const used = Number(usedRow?.value ?? 0)
    return { annual, used, remaining: annual - used }
  },

  async createVacation(
    payload: VacationCreatePayload & { userId: string; daysTotal: number }
  ): Promise<VacationItem> {
    const balance = await this.getMyVacationBalance(payload.userId)
    const daysRemainingSnapshot =
      payload.type === "annual" ? balance.remaining - payload.daysTotal : balance.remaining

    const [inserted] = await db
      .insert(vacations)
      .values({
        userId: payload.userId,
        startDate: payload.startDate,
        endDate: payload.endDate,
        daysTotal: payload.daysTotal,
        daysRemaining: daysRemainingSnapshot,
        status: "pending",
        type: payload.type,
        comment: payload.comment ?? null,
      })
      .returning({
        id: vacations.id,
        userId: vacations.userId,
        startDate: vacations.startDate,
        endDate: vacations.endDate,
        daysTotal: vacations.daysTotal,
        daysRemaining: vacations.daysRemaining,
        status: vacations.status,
        type: vacations.type,
        comment: vacations.comment,
        approvedBy: vacations.approvedBy,
        createdAt: vacations.createdAt,
      })

    if (!inserted) {
      throw new Error("Не удалось создать заявку на отпуск")
    }

    return mapVacationRowToItem(inserted)
  },

  async listAdminVacations(filter?: { status?: VacationStatus }): Promise<AdminVacationItem[]> {
    const statusFilter = filter?.status ?? "pending"
    const rows = await db
      .select({
        id: vacations.id,
        userId: vacations.userId,
        startDate: vacations.startDate,
        endDate: vacations.endDate,
        daysTotal: vacations.daysTotal,
        daysRemaining: vacations.daysRemaining,
        status: vacations.status,
        type: vacations.type,
        comment: vacations.comment,
        approvedBy: vacations.approvedBy,
        createdAt: vacations.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        departmentName: departments.name,
      })
      .from(vacations)
      .leftJoin(users, eq(users.id, vacations.userId))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(eq(vacations.status, statusFilter))
      .orderBy(desc(vacations.createdAt))

    return rows.map((row) => ({
      ...mapVacationRowToItem(row),
      authorName:
        `${row.authorLastName ?? ""} ${row.authorFirstName ?? ""}`.trim() || "Сотрудник",
      authorDepartment: row.departmentName ?? null,
    }))
  },

  async updateAdminVacation(
    id: string,
    payload: VacationAdminUpdatePayload & { approvedBy: string }
  ): Promise<VacationItem> {
    const [existing] = await db
      .select({ comment: vacations.comment })
      .from(vacations)
      .where(eq(vacations.id, id))
      .limit(1)

    if (!existing) {
      throw new Error("Заявка на отпуск не найдена")
    }

    const nextComment =
      payload.comment !== undefined && payload.comment !== null
        ? payload.comment
        : existing.comment

    const [updated] = await db
      .update(vacations)
      .set({
        status: payload.status,
        comment: nextComment,
        approvedBy: payload.approvedBy,
      })
      .where(eq(vacations.id, id))
      .returning({
        id: vacations.id,
        userId: vacations.userId,
        startDate: vacations.startDate,
        endDate: vacations.endDate,
        daysTotal: vacations.daysTotal,
        daysRemaining: vacations.daysRemaining,
        status: vacations.status,
        type: vacations.type,
        comment: vacations.comment,
        approvedBy: vacations.approvedBy,
        createdAt: vacations.createdAt,
      })

    if (!updated) {
      throw new Error("Не удалось обновить заявку на отпуск")
    }

    return mapVacationRowToItem(updated)
  },

  async listEventsForMonth(query: EventsMonthQuery): Promise<EventsListResponse> {
    const { monthStart, monthEnd, monthNumber, yearNumber } = parseMonth(query.month)
    const categoryFilter = query.category && query.category !== "all" ? query.category : undefined
    const includeBirthdays = !categoryFilter || categoryFilter === "birthday"
    const includeStored = !categoryFilter || categoryFilter !== "birthday"

    const items: CalendarEvent[] = []

    if (includeStored) {
      const where = and(
        gte(events.startAt, monthStart),
        lt(events.startAt, monthEnd),
        categoryFilter ? eq(events.category, categoryFilter) : undefined
      )
      const rows = await db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          startAt: events.startAt,
          endAt: events.endAt,
          location: events.location,
          category: events.category,
          isAllDay: events.isAllDay,
          createdBy: events.createdBy,
          createdAt: events.createdAt,
        })
        .from(events)
        .where(where)
        .orderBy(asc(events.startAt))

      for (const row of rows) {
        items.push({
          id: row.id,
          title: row.title,
          description: row.description ?? null,
          startAt: row.startAt.toISOString(),
          endAt: row.endAt ? row.endAt.toISOString() : null,
          location: row.location ?? null,
          category: normalizeEventCategory(row.category),
          isAllDay: row.isAllDay,
          createdBy: row.createdBy ?? null,
          createdAt: row.createdAt.toISOString(),
          isVirtual: false,
        })
      }
    }

    if (includeBirthdays) {
      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          birthDate: employeeProfiles.birthDate,
        })
        .from(users)
        .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
        .where(
          and(
            eq(users.isActive, true),
            isNotNull(employeeProfiles.birthDate),
            sql`EXTRACT(MONTH FROM ${employeeProfiles.birthDate}) = ${monthNumber}`
          )
        )

      for (const row of rows) {
        if (!row.birthDate) continue
        const day = Number(row.birthDate.slice(8, 10))
        if (!Number.isFinite(day) || day < 1 || day > 31) continue
        const fullName = `${row.lastName ?? ""} ${row.firstName ?? ""}`.trim() || "Сотрудник"
        const startAt = new Date(Date.UTC(yearNumber, monthNumber - 1, day, 0, 0, 0))
        items.push({
          id: `birthday-${row.id}-${startAt.toISOString().slice(0, 10)}`,
          title: `День рождения: ${fullName}`,
          description: null,
          startAt: startAt.toISOString(),
          endAt: null,
          location: null,
          category: "birthday",
          isAllDay: true,
          createdBy: null,
          createdAt: startAt.toISOString(),
          isVirtual: true,
        })
      }
    }

    items.sort((a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0))
    return { items, month: query.month }
  },

  async createEvent(payload: EventCreatePayload & { createdBy: string }): Promise<CalendarEvent> {
    const [inserted] = await db
      .insert(events)
      .values({
        title: payload.title,
        description: payload.description ?? null,
        startAt: new Date(payload.startAt),
        endAt: payload.endAt ? new Date(payload.endAt) : null,
        location: payload.location ?? null,
        category: payload.category,
        isAllDay: payload.isAllDay ?? false,
        createdBy: payload.createdBy,
      })
      .returning({
        id: events.id,
        title: events.title,
        description: events.description,
        startAt: events.startAt,
        endAt: events.endAt,
        location: events.location,
        category: events.category,
        isAllDay: events.isAllDay,
        createdBy: events.createdBy,
        createdAt: events.createdAt,
      })

    if (!inserted) {
      throw new Error("Не удалось создать событие")
    }

    return {
      id: inserted.id,
      title: inserted.title,
      description: inserted.description ?? null,
      startAt: inserted.startAt.toISOString(),
      endAt: inserted.endAt ? inserted.endAt.toISOString() : null,
      location: inserted.location ?? null,
      category: normalizeEventCategory(inserted.category),
      isAllDay: inserted.isAllDay,
      createdBy: inserted.createdBy ?? null,
      createdAt: inserted.createdAt.toISOString(),
      isVirtual: false,
    }
  },

  async deleteEvent(id: string): Promise<void> {
    if (id.startsWith("birthday-")) {
      throw new EventDeletionError("Дни рождения нельзя удалить — они формируются автоматически")
    }
    await db.delete(events).where(eq(events.id, id))
  },

  async listKnowledgeArticles(
    query?: KnowledgeListQuery,
    includeDrafts = false
  ): Promise<KnowledgeListResponse> {
    const page = query?.page ?? 1
    const limit = query?.limit ?? 20
    const offset = (page - 1) * limit
    const filterCategory =
      query?.category && query.category !== "all" ? query.category : undefined
    const searchTerm = query?.search?.trim()

    const where = and(
      !includeDrafts ? eq(knowledgeArticles.isPublished, true) : undefined,
      filterCategory ? eq(knowledgeArticles.category, filterCategory) : undefined,
      searchTerm
        ? or(
            ilike(knowledgeArticles.title, `%${searchTerm}%`),
            ilike(knowledgeArticles.content, `%${searchTerm}%`)
          )
        : undefined
    )

    const [totalRow] = await db
      .select({ value: count() })
      .from(knowledgeArticles)
      .where(where)

    const rows = await db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        content: knowledgeArticles.content,
        category: knowledgeArticles.category,
        tags: knowledgeArticles.tags,
        authorId: knowledgeArticles.authorId,
        isPublished: knowledgeArticles.isPublished,
        viewsCount: knowledgeArticles.viewsCount,
        createdAt: knowledgeArticles.createdAt,
        updatedAt: knowledgeArticles.updatedAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(knowledgeArticles)
      .leftJoin(users, eq(knowledgeArticles.authorId, users.id))
      .where(where)
      .orderBy(desc(knowledgeArticles.updatedAt), desc(knowledgeArticles.createdAt))
      .limit(limit)
      .offset(offset)

    return {
      items: rows.map((row) => mapKnowledgeRow(row)),
      total: Number(totalRow?.value ?? 0),
      page,
      limit,
    }
  },

  async getKnowledgeArticleById(
    id: string,
    includeDrafts = false
  ): Promise<KnowledgeDetailResponse> {
    const where = and(
      eq(knowledgeArticles.id, id),
      !includeDrafts ? eq(knowledgeArticles.isPublished, true) : undefined
    )
    const [row] = await db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        content: knowledgeArticles.content,
        category: knowledgeArticles.category,
        tags: knowledgeArticles.tags,
        authorId: knowledgeArticles.authorId,
        isPublished: knowledgeArticles.isPublished,
        viewsCount: knowledgeArticles.viewsCount,
        createdAt: knowledgeArticles.createdAt,
        updatedAt: knowledgeArticles.updatedAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(knowledgeArticles)
      .leftJoin(users, eq(knowledgeArticles.authorId, users.id))
      .where(where)
      .limit(1)

    if (!row) return { item: null }
    return { item: mapKnowledgeRow(row) }
  },

  async incrementKnowledgeArticleViews(id: string): Promise<void> {
    await db
      .update(knowledgeArticles)
      .set({ viewsCount: sql`${knowledgeArticles.viewsCount} + 1` })
      .where(eq(knowledgeArticles.id, id))
  },

  async createKnowledgeArticle(
    payload: KnowledgeEditorPayload & { authorId: string }
  ): Promise<KnowledgeArticle> {
    const [inserted] = await db
      .insert(knowledgeArticles)
      .values({
        title: payload.title,
        content: payload.content,
        category: payload.category,
        tags: payload.tags ?? null,
        isPublished: payload.isPublished ?? false,
        authorId: payload.authorId,
      })
      .returning({ id: knowledgeArticles.id })

    if (!inserted) {
      throw new Error("Не удалось создать статью базы знаний")
    }

    const detail = await this.getKnowledgeArticleById(inserted.id, true)
    if (!detail.item) {
      throw new Error("Не удалось загрузить созданную статью")
    }
    return detail.item
  },

  async updateKnowledgeArticle(
    id: string,
    payload: KnowledgeEditorPayload
  ): Promise<KnowledgeArticle> {
    await db
      .update(knowledgeArticles)
      .set({
        title: payload.title,
        content: payload.content,
        category: payload.category,
        tags: payload.tags ?? null,
        isPublished: payload.isPublished ?? false,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeArticles.id, id))

    const detail = await this.getKnowledgeArticleById(id, true)
    if (!detail.item) {
      throw new Error("Статья базы знаний не найдена")
    }
    return detail.item
  },

  async deleteKnowledgeArticle(id: string): Promise<void> {
    await db.delete(knowledgeArticles).where(eq(knowledgeArticles.id, id))
  },

  async listTicketCategories(activeOnly = false): Promise<TicketCategoriesResponse> {
    const rows = await db
      .select()
      .from(ticketCategories)
      .where(activeOnly ? eq(ticketCategories.isActive, true) : undefined)
      .orderBy(asc(ticketCategories.sortOrder), asc(ticketCategories.label))

    return { items: rows.map(mapTicketCategoryRow) }
  },

  async createTicketCategory(payload: TicketCategoryUpsertPayload): Promise<TicketCategoryItem> {
    const [created] = await db
      .insert(ticketCategories)
      .values({
        slug: payload.slug,
        label: payload.label,
        description: payload.description ?? null,
        isActive: payload.isActive ?? true,
        sortOrder: payload.sortOrder ?? 0,
        updatedAt: new Date(),
      })
      .returning()

    return mapTicketCategoryRow(created)
  },

  async updateTicketCategory(
    id: string,
    payload: Partial<TicketCategoryUpsertPayload>
  ): Promise<TicketCategoryItem> {
    const [updated] = await db
      .update(ticketCategories)
      .set({
        ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.description !== undefined ? { description: payload.description ?? null } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(eq(ticketCategories.id, id))
      .returning()

    if (!updated) {
      throw new Error("Категория не найдена")
    }
    return mapTicketCategoryRow(updated)
  },

  async deleteTicketCategory(id: string): Promise<void> {
    await db.delete(ticketCategories).where(eq(ticketCategories.id, id))
  },

  async listAdminDepartments(): Promise<AdminDepartmentsResponse> {
    const parentAlias = alias(departments, "parent_dept")
    const headAlias = alias(users, "head_user")

    const rows = await db
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
        description: departments.description,
        parentId: departments.parentId,
        parentName: parentAlias.name,
        headUserId: departments.headUserId,
        headFirstName: headAlias.firstName,
        headLastName: headAlias.lastName,
        contactEmail: departments.contactEmail,
        plannedHeadcount: departments.plannedHeadcount,
        externalKey: departments.externalKey,
        isArchived: departments.isArchived,
      })
      .from(departments)
      .leftJoin(parentAlias, eq(parentAlias.id, departments.parentId))
      .leftJoin(headAlias, eq(headAlias.id, departments.headUserId))
      .where(eq(departments.isArchived, false))
      .orderBy(asc(departments.name))

    const counts = await db
      .select({ departmentId: users.departmentId, value: count() })
      .from(users)
      .where(isNotNull(users.departmentId))
      .groupBy(users.departmentId)

    const countById = new Map<string, number>()
    for (const row of counts) {
      if (row.departmentId) countById.set(row.departmentId, Number(row.value))
    }

    const items: AdminDepartmentItem[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code ?? null,
      description: row.description ?? null,
      parentId: row.parentId ?? null,
      parentName: row.parentName ?? null,
      headUserId: row.headUserId ?? null,
      headName: fullName(row.headLastName, row.headFirstName) || null,
      contactEmail: row.contactEmail ?? null,
      employeeCount: countById.get(row.id) ?? 0,
      plannedHeadcount: row.plannedHeadcount ?? null,
      externalKey: row.externalKey ?? null,
      isArchived: row.isArchived ?? false,
    }))

    return { items }
  },

  async getAdminDepartmentById(id: string): Promise<{ item: AdminDepartmentItem | null }> {
    const list = await this.listAdminDepartments()
    return { item: list.items.find((d) => d.id === id) ?? null }
  },

  async createDepartment(
    payload: AdminDepartmentUpsertPayload
  ): Promise<AdminDepartmentItem> {
    const trimmedName = payload.name.trim()
    const [duplicate] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(sql`LOWER(${departments.name}) = LOWER(${trimmedName})`)
      .limit(1)
    if (duplicate) {
      throw new DepartmentMutationError(
        "Подразделение с таким названием уже существует",
        "DUPLICATE_NAME"
      )
    }

    const [inserted] = await db
      .insert(departments)
      .values({
        name: trimmedName,
        code: payload.code ?? null,
        description: payload.description ?? null,
        parentId: payload.parentId ?? null,
        headUserId: payload.headUserId ?? null,
        contactEmail: payload.contactEmail ?? null,
      })
      .returning({ id: departments.id })

    if (!inserted) {
      throw new Error("Не удалось создать подразделение")
    }

    const detail = await this.getAdminDepartmentById(inserted.id)
    if (!detail.item) {
      throw new Error("Не удалось загрузить созданное подразделение")
    }
    return detail.item
  },

  async updateDepartment(
    id: string,
    payload: AdminDepartmentUpsertPayload
  ): Promise<AdminDepartmentItem> {
    if (payload.parentId && payload.parentId === id) {
      throw new DepartmentMutationError(
        "Подразделение не может быть родителем самому себе",
        "INVALID_PARENT"
      )
    }

    const trimmedName = payload.name.trim()
    const [duplicate] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(
        and(
          sql`LOWER(${departments.name}) = LOWER(${trimmedName})`,
          sql`${departments.id} <> ${id}`
        )
      )
      .limit(1)
    if (duplicate) {
      throw new DepartmentMutationError(
        "Подразделение с таким названием уже существует",
        "DUPLICATE_NAME"
      )
    }

    await db
      .update(departments)
      .set({
        name: trimmedName,
        code: payload.code ?? null,
        description: payload.description ?? null,
        parentId: payload.parentId ?? null,
        headUserId: payload.headUserId ?? null,
        contactEmail: payload.contactEmail ?? null,
      })
      .where(eq(departments.id, id))

    const detail = await this.getAdminDepartmentById(id)
    if (!detail.item) {
      throw new DepartmentMutationError("Подразделение не найдено", "NOT_FOUND")
    }
    return detail.item
  },

  async deleteDepartment(id: string): Promise<void> {
    const [childrenCount] = await db
      .select({ value: count() })
      .from(departments)
      .where(eq(departments.parentId, id))
    if (Number(childrenCount?.value ?? 0) > 0) {
      throw new DepartmentMutationError(
        "Нельзя удалить подразделение с дочерними подразделениями.",
        "HAS_CHILDREN"
      )
    }

    const [employeesCount] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.departmentId, id))
    if (Number(employeesCount?.value ?? 0) > 0) {
      throw new DepartmentMutationError(
        "Нельзя удалить подразделение с сотрудниками. Сначала переведите их.",
        "HAS_EMPLOYEES"
      )
    }

    await db.delete(departments).where(eq(departments.id, id))
  },

  async previewOrgStructureImport(parsed: ParsedOrgStructure): Promise<OrgStructureImportPreview> {
    const [departmentsList, employeesList] = await Promise.all([
      this.listAdminDepartments(),
      this.listAdminEmployees(),
    ])

    return buildOrgStructureImportPreview(
      parsed,
      departmentsList.items,
      employeesList.items.map((employee) => ({
        fullName: employee.fullName,
        departmentName: employee.departmentName,
        positionTitle: employee.positionTitle,
        startDate: employee.startDate,
      }))
    )
  },

  async importOrgStructure(
    parsed: ParsedOrgStructure,
    options: OrgStructureImportOptions
  ): Promise<OrgStructureImportResult> {
    let departmentsCreated = 0
    let departmentsUpdated = 0
    let employeesCreated = 0
    let employeesUpdated = 0
    let employeesNotFound = 0
    const warnings = [...parsed.warnings]

    if (options.applyDepartments) {
      const existing = await this.listAdminDepartments()
      const idByExternalKey = new Map<string, string>()
      const idByName = new Map<string, string>()

      for (const item of existing.items) {
        if (item.externalKey) idByExternalKey.set(item.externalKey, item.id)
        idByName.set(normalizeDepartmentKey(item.name), item.id)
      }

      for (const incoming of parsed.departments) {
        const existingId =
          idByExternalKey.get(incoming.externalKey) ?? idByName.get(normalizeDepartmentKey(incoming.name))

        if (existingId) {
          await db
            .update(departments)
            .set({
              name: incoming.name,
              externalKey: incoming.externalKey,
              plannedHeadcount: incoming.plannedHeadcount,
              isArchived: false,
            })
            .where(eq(departments.id, existingId))
          departmentsUpdated += 1
          idByExternalKey.set(incoming.externalKey, existingId)
          idByName.set(normalizeDepartmentKey(incoming.name), existingId)
        } else {
          const [created] = await db
            .insert(departments)
            .values({
              name: incoming.name,
              externalKey: incoming.externalKey,
              plannedHeadcount: incoming.plannedHeadcount,
              isArchived: false,
            })
            .returning({ id: departments.id })
          if (created) {
            departmentsCreated += 1
            idByExternalKey.set(incoming.externalKey, created.id)
            idByName.set(normalizeDepartmentKey(incoming.name), created.id)
          }
        }
      }

      for (const incoming of parsed.departments) {
        const departmentId =
          idByExternalKey.get(incoming.externalKey) ?? idByName.get(normalizeDepartmentKey(incoming.name))
        if (!departmentId) continue

        const parentId = incoming.parentName
          ? (idByName.get(normalizeDepartmentKey(incoming.parentName)) ?? null)
          : null

        if (incoming.parentName && !parentId) {
          warnings.push(`Не найден родитель «${incoming.parentName}» для «${incoming.name}»`)
        }

        await db.update(departments).set({ parentId }).where(eq(departments.id, departmentId))
      }
    }

    if (options.applyEmployees) {
      const departmentsList = await this.listAdminDepartments()
      const processedNames = new Set<string>()

      const existingUsers = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          middleName: employeeProfiles.middleName,
        })
        .from(users)
        .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))

      const existingUserIdByName = new Map<string, string>()
      for (const user of existingUsers) {
        existingUserIdByName.set(
          employeeNameKey({
            lastName: user.lastName,
            firstName: user.firstName,
            middleName: user.middleName ?? null,
          }),
          user.id
        )
      }

      const bulkImportPasswordHash = await hashPassword(crypto.randomUUID())

      for (const assignment of parsed.assignments) {
        const nameParts = parseFullName(assignment.fullName)
        const nameKey = employeeNameKey(nameParts)
        if (processedNames.has(nameKey)) continue
        processedNames.add(nameKey)

        const departmentId = resolveDepartmentId(assignment.departmentName, departmentsList.items)
        if (!departmentId) {
          warnings.push(`Не найден отдел «${assignment.departmentName}» для «${assignment.fullName}»`)
          employeesNotFound += 1
          continue
        }

        const existingUserId = existingUserIdByName.get(nameKey)
        const now = new Date()

        if (!existingUserId) {
          const email = generatePlaceholderEmail()
          const [createdUser] = await db
            .insert(users)
            .values({
              email,
              passwordHash: bulkImportPasswordHash,
              firstName: nameParts.firstName,
              lastName: nameParts.lastName,
              role: "employee",
              departmentId,
              isActive: true,
            })
            .returning({ id: users.id })

          if (!createdUser) {
            employeesNotFound += 1
            continue
          }

          await db.insert(employeeProfiles).values({
            userId: createdUser.id,
            middleName: nameParts.middleName,
            positionTitle: assignment.positionTitle,
            startDate: assignment.hireDate ?? null,
            phone: assignment.phone ?? null,
            presence: "office",
            updatedAt: now,
          })

          existingUserIdByName.set(nameKey, createdUser.id)
          employeesCreated += 1
          continue
        }

        await db
          .update(users)
          .set({ departmentId, updatedAt: now })
          .where(eq(users.id, existingUserId))

        await db
          .update(employeeProfiles)
          .set({
            positionTitle: assignment.positionTitle,
            ...(assignment.hireDate ? { startDate: assignment.hireDate } : {}),
            ...(assignment.phone ? { phone: assignment.phone } : {}),
            updatedAt: now,
          })
          .where(eq(employeeProfiles.userId, existingUserId))

        employeesUpdated += 1
      }
    }

    await db.insert(orgImportRuns).values({
      userId: options.userId ?? null,
      fileName: options.fileName ?? null,
      syncMode: options.syncMode ?? "merge",
      applyDepartments: options.applyDepartments,
      applyEmployees: options.applyEmployees,
      stats: JSON.stringify({
        departmentsCreated,
        departmentsUpdated,
        employeesCreated,
        employeesUpdated,
        employeesNotFound,
      }),
      warningsCount: warnings.length,
    })

    return {
      departmentsCreated,
      departmentsUpdated,
      employeesCreated,
      employeesUpdated,
      employeesNotFound,
      warnings,
    }
  },

  async listAdminPortalUsers(): Promise<AdminPortalUsersResponse> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .orderBy(asc(users.lastName), asc(users.firstName))

    return {
      items: rows.map((row) => mapAdminPortalUserRow(row as AdminPortalUserRow)),
    }
  },

  async getAdminPortalUserById(id: string): Promise<AdminPortalUserItem | null> {
    return selectAdminPortalUserById(id)
  },

  async createAdminPortalUser(payload: AdminPortalUserCreatePayload): Promise<AdminPortalUserItem> {
    const email = payload.email.trim().toLowerCase()
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    if (existing) {
      throw new PortalUserMutationError("Пользователь с таким email уже существует", "CONFLICT", 409)
    }

    if (payload.departmentId) {
      const [dept] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, payload.departmentId))
        .limit(1)
      if (!dept) {
        throw new PortalUserMutationError("Подразделение не найдено", "NOT_FOUND", 404)
      }
    }

    const passwordHash = await hashPassword(payload.password)
    const now = new Date()
    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        role: payload.role,
        departmentId: payload.departmentId ?? null,
        isActive: true,
        updatedAt: now,
      })
      .returning({ id: users.id })

    if (!created) {
      throw new PortalUserMutationError("Не удалось создать пользователя", "INTERNAL_ERROR", 500)
    }

    await db.insert(employeeProfiles).values({
      userId: created.id,
      presence: "office",
      updatedAt: now,
    })

    const item = await selectAdminPortalUserById(created.id)
    if (!item) {
      throw new PortalUserMutationError("Не удалось загрузить созданного пользователя", "INTERNAL_ERROR", 500)
    }
    return item
  },

  async updateAdminPortalUserRole(id: string, role: UserRole): Promise<AdminPortalUserItem> {
    const current = await selectAdminPortalUserById(id)
    if (!current) {
      throw new PortalUserMutationError("Пользователь не найден", "NOT_FOUND", 404)
    }

    const now = new Date()
    await db.update(users).set({ role, updatedAt: now }).where(eq(users.id, id))

    const next = await selectAdminPortalUserById(id)
    if (!next) {
      throw new PortalUserMutationError("Пользователь не найден", "NOT_FOUND", 404)
    }
    return next
  },

  async updateAdminPortalUserCredentials(
    id: string,
    payload: { email?: string; password?: string }
  ): Promise<AdminPortalUserItem> {
    const current = await selectAdminPortalUserById(id)
    if (!current) {
      throw new PortalUserMutationError("Пользователь не найден", "NOT_FOUND", 404)
    }

    const updates: {
      email?: string
      passwordHash?: string
      updatedAt: Date
    } = { updatedAt: new Date() }
    let shouldRevokeSessions = false

    if (payload.email !== undefined && payload.email.length > 0) {
      const nextEmail = payload.email.trim().toLowerCase()
      if (nextEmail !== current.email) {
        const [dup] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, nextEmail), ne(users.id, id)))
          .limit(1)
        if (dup) {
          throw new PortalUserMutationError("Пользователь с таким email уже существует", "CONFLICT", 409)
        }
        updates.email = nextEmail
        shouldRevokeSessions = true
      }
    }

    if (payload.password !== undefined && payload.password.length > 0) {
      updates.passwordHash = await hashPassword(payload.password)
      shouldRevokeSessions = true
    }

    if (Object.keys(updates).length === 1) {
      return current
    }

    await db.update(users).set(updates).where(eq(users.id, id))

    if (shouldRevokeSessions) {
      await revokeAllRefreshTokensForUser(id)
    }

    const next = await selectAdminPortalUserById(id)
    if (!next) {
      throw new PortalUserMutationError("Пользователь не найден", "NOT_FOUND", 404)
    }
    return next
  },

  async updateAdminPortalUserStatus(id: string, isActive: boolean): Promise<AdminPortalUserItem> {
    const current = await selectAdminPortalUserById(id)
    if (!current) {
      throw new PortalUserMutationError("Пользователь не найден", "NOT_FOUND", 404)
    }

    const now = new Date()
    await db.update(users).set({ isActive, updatedAt: now }).where(eq(users.id, id))

    const next = await selectAdminPortalUserById(id)
    if (!next) {
      throw new PortalUserMutationError("Пользователь не найден", "NOT_FOUND", 404)
    }
    return next
  },

  async deleteAdminPortalUser(id: string): Promise<void> {
    const current = await selectAdminPortalUserById(id)
    if (!current) {
      throw new PortalUserMutationError("Пользователь не найден", "NOT_FOUND", 404)
    }
    await db.delete(users).where(eq(users.id, id))
  },
}

export class PortalUserMutationError extends Error {
  status: number
  code: string

  constructor(message: string, code = "INVALID_PAYLOAD", status = 400) {
    super(message)
    this.name = "PortalUserMutationError"
    this.code = code
    this.status = status
  }
}

export class DepartmentMutationError extends Error {
  status = 400
  code: string

  constructor(message: string, code = "INVALID_PAYLOAD") {
    super(message)
    this.name = "DepartmentMutationError"
    this.code = code
  }
}

type TicketRow = {
  id: string
  authorId: string
  category: string
  subject: string
  description: string | null
  status: string
  priority: string
  assigneeId: string | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
  authorFirstName: string | null
  authorLastName: string | null
  assigneeFirstName: string | null
  assigneeLastName: string | null
}

const ticketAuthor = alias(users, "ticket_author")
const ticketAssignee = alias(users, "ticket_assignee")

function fullName(lastName: string | null, firstName: string | null): string {
  return `${lastName ?? ""} ${firstName ?? ""}`.trim()
}

function normalizeCategory(value: string): string {
  return value.trim() || "it"
}

function mapTicketCategoryRow(row: typeof ticketCategories.$inferSelect): TicketCategoryItem {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description ?? null,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function normalizeStatus(value: string): TicketStatus {
  if (value === "in_progress" || value === "resolved" || value === "closed") return value
  return "new"
}

function normalizePriority(value: string): TicketPriority {
  if (value === "low" || value === "high" || value === "critical") return value
  return "medium"
}

function mapTicketRow(row: TicketRow): Ticket {
  const authorName = fullName(row.authorLastName, row.authorFirstName) || "Не указан"
  const assigneeName = row.assigneeId
    ? fullName(row.assigneeLastName, row.assigneeFirstName) || "Не указан"
    : null
  return {
    id: row.id,
    authorId: row.authorId,
    authorName,
    category: normalizeCategory(row.category),
    subject: row.subject,
    description: row.description ?? null,
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    assigneeId: row.assigneeId ?? null,
    assigneeName,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function selectTicketRow(id: string): Promise<TicketRow | null> {
  const [row] = await db
    .select({
      id: tickets.id,
      authorId: tickets.authorId,
      category: tickets.category,
      subject: tickets.subject,
      description: tickets.description,
      status: tickets.status,
      priority: tickets.priority,
      assigneeId: tickets.assigneeId,
      resolvedAt: tickets.resolvedAt,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      authorFirstName: ticketAuthor.firstName,
      authorLastName: ticketAuthor.lastName,
      assigneeFirstName: ticketAssignee.firstName,
      assigneeLastName: ticketAssignee.lastName,
    })
    .from(tickets)
    .leftJoin(ticketAuthor, eq(tickets.authorId, ticketAuthor.id))
    .leftJoin(ticketAssignee, eq(tickets.assigneeId, ticketAssignee.id))
    .where(eq(tickets.id, id))
    .limit(1)

  return row ?? null
}

async function listTicketsInternal(params: {
  ownerId: string | null
  query?: TicketsQuery
}): Promise<TicketsListResponse> {
  const page = params.query?.page ?? 1
  const limit = params.query?.limit ?? 20
  const offset = (page - 1) * limit
  const statusFilter =
    params.query?.status && params.query.status !== "all" ? params.query.status : undefined

  const where = and(
    params.ownerId ? eq(tickets.authorId, params.ownerId) : undefined,
    statusFilter ? eq(tickets.status, statusFilter) : undefined
  )

  const [totalRow] = await db.select({ value: count() }).from(tickets).where(where)

  const rows = await db
    .select({
      id: tickets.id,
      authorId: tickets.authorId,
      category: tickets.category,
      subject: tickets.subject,
      description: tickets.description,
      status: tickets.status,
      priority: tickets.priority,
      assigneeId: tickets.assigneeId,
      resolvedAt: tickets.resolvedAt,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      authorFirstName: ticketAuthor.firstName,
      authorLastName: ticketAuthor.lastName,
      assigneeFirstName: ticketAssignee.firstName,
      assigneeLastName: ticketAssignee.lastName,
    })
    .from(tickets)
    .leftJoin(ticketAuthor, eq(tickets.authorId, ticketAuthor.id))
    .leftJoin(ticketAssignee, eq(tickets.assigneeId, ticketAssignee.id))
    .where(where)
    .orderBy(desc(tickets.createdAt))
    .limit(limit)
    .offset(offset)

  return {
    items: rows.map((row) => mapTicketRow(row)),
    total: Number(totalRow?.value ?? 0),
    page,
    limit,
  }
}

export class EventDeletionError extends Error {
  status = 400
  code = "INVALID_PAYLOAD"

  constructor(message: string) {
    super(message)
    this.name = "EventDeletionError"
  }
}

function parseMonth(month: string): {
  monthStart: Date
  monthEnd: Date
  monthNumber: number
  yearNumber: number
} {
  const [yearStr, monthStr] = month.split("-")
  const yearNumber = Number(yearStr)
  const monthNumber = Number(monthStr)
  const monthStart = new Date(Date.UTC(yearNumber, monthNumber - 1, 1, 0, 0, 0))
  const monthEnd = new Date(Date.UTC(yearNumber, monthNumber, 1, 0, 0, 0))
  return { monthStart, monthEnd, monthNumber, yearNumber }
}

type VacationRow = {
  id: string
  userId: string
  startDate: string
  endDate: string
  daysTotal: number
  daysRemaining: number
  status: string
  type: string
  comment: string | null
  approvedBy: string | null
  createdAt: Date
}

function normalizeVacationStatus(value: string): VacationStatus {
  if (value === "pending" || value === "approved" || value === "rejected") return value
  return "pending"
}

function normalizeVacationType(value: string): VacationType {
  if (value === "annual" || value === "sick" || value === "unpaid" || value === "maternity") {
    return value
  }
  return "annual"
}

function mapVacationRowToItem(row: VacationRow): VacationItem {
  return {
    id: row.id,
    userId: row.userId,
    startDate: row.startDate,
    endDate: row.endDate,
    daysTotal: row.daysTotal,
    daysRemaining: row.daysRemaining,
    status: normalizeVacationStatus(row.status),
    type: normalizeVacationType(row.type),
    comment: row.comment ?? null,
    approvedBy: row.approvedBy ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function normalizeEventCategory(value: string): EventCategory {
  if (
    value === "meeting" ||
    value === "birthday" ||
    value === "deadline" ||
    value === "holiday"
  ) {
    return value
  }
  return "corporate"
}

function mapKnowledgeCategory(value: string): KnowledgeCategory {
  if (
    value === "onboarding" ||
    value === "it" ||
    value === "hr" ||
    value === "safety" ||
    value === "general"
  ) {
    return value
  }
  return "general"
}

function parseTags(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

type KnowledgeRow = {
  id: string
  title: string
  content: string
  category: string
  tags: string | null
  authorId: string | null
  isPublished: boolean
  viewsCount: number
  createdAt: Date
  updatedAt: Date
  authorFirstName: string | null
  authorLastName: string | null
}

function mapKnowledgeRow(row: KnowledgeRow): KnowledgeArticle {
  const authorName =
    `${row.authorLastName ?? ""} ${row.authorFirstName ?? ""}`.trim() || "Не указан"
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: mapKnowledgeCategory(row.category),
    tags: parseTags(row.tags),
    authorId: row.authorId ?? null,
    authorName,
    isPublished: row.isPublished,
    viewsCount: row.viewsCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
