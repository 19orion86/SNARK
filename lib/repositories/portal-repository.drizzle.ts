import "server-only"
import { and, count, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { departments, documents, employeeProfiles, news, users, vacations } from "@/lib/db/schema"
import { hashPassword } from "@/lib/auth/password"
import { mapContactsData, mapDocumentsData, mapProfileData } from "@/lib/mappers/portal"
import { mockPortalRepository } from "@/lib/repositories/portal-repository.mock"
import type { PortalRepository } from "@/lib/repositories/portal-repository.types"
import type {
  AdminEmployeeItem,
  AdminEmployeeUpsertPayload,
  AdminEmployeesResponse,
  DocumentMetadataCreatePayload,
  DocumentsData,
  DocumentsQuery,
  Employee,
  EmployeeImportResult,
  EmployeesQuery,
  NewsDetailResponse,
  NewsEditorPayload,
  NewsListQuery,
  NewsListResponse,
  ProfileData,
  ProfilePresenceUpdatePayload,
  ProfileUpdatePayload,
} from "@/types/portal"
import type { UserRole } from "@/types/auth"

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
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
  async getDashboardData(userId?: string) {
    const today = new Date()
    const todayMonth = today.getMonth() + 1
    const todayDay = today.getDate()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)

    const birthdayRows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        positionTitle: employeeProfiles.positionTitle,
        avatarUrl: employeeProfiles.avatarUrl,
        departmentName: departments.name,
        birthDate: employeeProfiles.birthDate,
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(
        and(
          eq(users.isActive, true),
          sql`EXTRACT(MONTH FROM ${employeeProfiles.birthDate}::date) = ${todayMonth}`,
          sql`EXTRACT(DAY FROM ${employeeProfiles.birthDate}::date) = ${todayDay}`
        )
      )

    const newEmployeeRows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        positionTitle: employeeProfiles.positionTitle,
        avatarUrl: employeeProfiles.avatarUrl,
        departmentName: departments.name,
        startDate: employeeProfiles.startDate,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(and(eq(users.isActive, true), sql`${users.createdAt} >= ${thirtyDaysAgo.toISOString()}`))
      .orderBy(desc(users.createdAt))
      .limit(5)

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

    const fallback = await mockPortalRepository.getDashboardData()

    return {
      ...fallback,
      todayBirthdays: birthdayRows.map((row) => ({
        id: row.id,
        name: `${row.firstName} ${row.lastName}`.trim(),
        position: row.positionTitle ?? "Сотрудник",
        department: row.departmentName ?? "Без отдела",
        avatar: `${row.firstName.charAt(0)}${row.lastName.charAt(0)}`.toUpperCase(),
        email: row.email,
      })),
      newEmployees: newEmployeeRows.map((row) => ({
        id: row.id,
        name: `${row.firstName} ${row.lastName}`.trim(),
        position: row.positionTitle ?? "Сотрудник",
        department: row.departmentName ?? "Без отдела",
        avatar: `${row.firstName.charAt(0)}${row.lastName.charAt(0)}`.toUpperCase(),
        startDate: row.startDate ?? row.createdAt.toISOString().slice(0, 10),
      })),
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

    // Основной SELECT с JOIN
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isActive: users.isActive,
        phone: employeeProfiles.phone,
        positionTitle: employeeProfiles.positionTitle,
        avatarUrl: employeeProfiles.avatarUrl,
        presence: employeeProfiles.presence,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(where)
      .orderBy(sql`${users.lastName} asc, ${users.firstName} asc`)
      .limit(limit)
      .offset(offset)

    // Список отделов для фильтра — по НАЗВАНИЮ, не UUID
    const deptList = await db
      .selectDistinct({ name: departments.name })
      .from(departments)
      .where(isNotNull(departments.name))

    const departmentNames = [
      "Все",
      ...deptList.map((d) => d.name).filter((n): n is string => !!n),
    ]

    // Маппинг строк в Employee
    const employees: Employee[] = rows.map((row, idx) => ({
      id: offset + idx + 1,
      name: `${row.firstName} ${row.lastName}`.trim(),
      position: row.positionTitle ?? "Сотрудник",
      department: row.departmentName ?? "Без отдела",
      phone: row.phone ?? "Не указан",
      email: row.email,
      office: "Не указан",
      status:
        mapPresenceFromLegacy(row.presence) === "office"
          ? "online"
          : mapPresenceFromLegacy(row.presence) === "vacation"
            ? "away"
            : "offline",
      avatar: initials(row.firstName, row.lastName),
      avatarUrl: row.avatarUrl ?? undefined,
    }))

    return mapContactsData({
      employees,
      departments: departmentNames,
      total: Number(totalRow?.value ?? 0),
      page,
      limit,
    })
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

    const approvedVacations = await db
      .select({
        id: vacations.id,
        userId: vacations.userId,
        startDate: vacations.startDate,
        endDate: vacations.endDate,
        daysTotal: vacations.daysTotal,
        daysRemaining: vacations.daysRemaining,
        status: vacations.status,
        createdAt: vacations.createdAt,
      })
      .from(vacations)
      .where(and(eq(vacations.userId, userId), eq(vacations.status, "approved")))
      .orderBy(desc(vacations.startDate))

    const today = new Date()
    const todayIso = today.toISOString().slice(0, 10)
    const nextVacationRaw = approvedVacations
      .filter((item) => item.startDate > todayIso)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    const previousVacations = approvedVacations
      .filter((item) => item.startDate <= todayIso)
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
      fullName: `${row.firstName} ${row.lastName}`,
      initials: `${row.firstName.charAt(0)}${row.lastName.charAt(0)}`.toUpperCase(),
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
              fullName: `${departmentHead.lastName} ${departmentHead.firstName}`.trim(),
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
        history: previousVacations.map((item) => ({
          id: item.id,
          userId: item.userId,
          startDate: item.startDate,
          endDate: item.endDate,
          daysTotal: item.daysTotal,
          daysRemaining: item.daysRemaining,
          status: item.status === "pending" ? "pending" : "approved",
          createdAt: item.createdAt.toISOString(),
        })),
      },
      vacations: approvedVacations.map((item) => ({
        id: item.id,
        userId: item.userId,
        startDate: item.startDate,
        endDate: item.endDate,
        daysTotal: item.daysTotal,
        daysRemaining: item.daysRemaining,
        status: item.status === "pending" ? "pending" : "approved",
        createdAt: item.createdAt.toISOString(),
      })),
    })
  },

  async updateProfile(userId: string, payload: ProfileUpdatePayload): Promise<ProfileData> {
    await db
      .insert(employeeProfiles)
      .values({
        userId,
        phone: payload.phone ?? null,
        avatarUrl: payload.avatarUrl ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: employeeProfiles.userId,
        set: {
          phone: payload.phone ?? null,
          avatarUrl: payload.avatarUrl ?? null,
          updatedAt: new Date(),
        },
      })

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
      })),
    }
  },

  async createAdminEmployee(payload: AdminEmployeeUpsertPayload): Promise<AdminEmployeeItem> {
    const result = await this.importEmployees([payload])
    if (result.errors.length > 0) {
      throw new Error(result.errors[0]?.reason ?? "IMPORT_FAILED")
    }
    const listed = await this.listAdminEmployees()
    const normalizedEmail = payload.email.trim().toLowerCase()
    const created = listed.items.find((item) => item.email.toLowerCase() === normalizedEmail)
    if (!created) {
      throw new Error("EMPLOYEE_NOT_FOUND")
    }
    return created
  },

  async updateAdminEmployee(id: string, payload: AdminEmployeeUpsertPayload): Promise<AdminEmployeeItem> {
    const nameParts = parseFullName(payload.fullName)
    const now = new Date()

    const departmentId = await getOrCreateDepartmentIdByName(payload.departmentName, {
      code: payload.departmentCode,
      contactEmail: payload.departmentEmail,
    })

    await db
      .update(users)
      .set({
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        email: payload.email.trim().toLowerCase(),
        departmentId,
        isActive: payload.status === "dismissed" ? false : true,
        updatedAt: now,
      })
      .where(eq(users.id, id))

    await db
      .insert(employeeProfiles)
      .values({
        userId: id,
        middleName: nameParts.middleName,
        phone: payload.phone?.trim() || null,
        positionTitle: payload.positionTitle.trim(),
        presence: mapStatusToPresence(payload.status),
        birthDate: payload.birthDate || null,
        startDate: payload.startDate || null,
        welcomeNote: payload.welcomeNote?.trim() || null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: employeeProfiles.userId,
        set: {
          middleName: nameParts.middleName,
          phone: payload.phone?.trim() || null,
          positionTitle: payload.positionTitle.trim(),
          presence: mapStatusToPresence(payload.status),
          birthDate: payload.birthDate || null,
          startDate: payload.startDate || null,
          welcomeNote: payload.welcomeNote?.trim() || null,
          updatedAt: now,
        },
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
        const normalizedEmail = row.email.trim().toLowerCase()
        const departmentName = row.departmentName.trim()
        const now = new Date()

        const departmentId = await getOrCreateDepartmentIdByName(departmentName, {
          code: row.departmentCode,
          contactEmail: row.departmentEmail,
        })

        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1)

        let userId = existing?.id
        if (existing) {
          await db
            .update(users)
            .set({
              firstName: nameParts.firstName,
              lastName: nameParts.lastName,
              departmentId,
              isActive: row.status === "dismissed" ? false : true,
              updatedAt: now,
            })
            .where(eq(users.id, existing.id))
          updated += 1
        } else {
          const generatedPassword = crypto.randomUUID()
          const passwordHash = await hashPassword(generatedPassword)
          const [createdUser] = await db
            .insert(users)
            .values({
              email: normalizedEmail,
              passwordHash,
              firstName: nameParts.firstName,
              lastName: nameParts.lastName,
              role: "employee",
              departmentId,
              isActive: row.status === "dismissed" ? false : true,
            })
            .returning({ id: users.id })
          userId = createdUser.id
          created += 1
        }

        if (!userId) {
          throw new Error("Не удалось определить пользователя")
        }

        await db
          .insert(employeeProfiles)
          .values({
            userId,
            middleName: nameParts.middleName,
            phone: row.phone?.trim() || null,
            positionTitle: row.positionTitle.trim(),
            presence: mapStatusToPresence(row.status),
            birthDate: row.birthDate || null,
            startDate: row.startDate || null,
            welcomeNote: row.welcomeNote?.trim() || null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: employeeProfiles.userId,
            set: {
              middleName: nameParts.middleName,
              phone: row.phone?.trim() || null,
              positionTitle: row.positionTitle.trim(),
              presence: mapStatusToPresence(row.status),
              birthDate: row.birthDate || null,
              startDate: row.startDate || null,
              welcomeNote: row.welcomeNote?.trim() || null,
              updatedAt: now,
            },
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
}
