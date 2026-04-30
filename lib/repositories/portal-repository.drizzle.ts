import "server-only"
import { and, count, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { documents, employeeProfiles, users } from "@/lib/db/schema"
import { mapContactsData, mapDocumentsData, mapProfileData } from "@/lib/mappers/portal"
import { mockPortalRepository } from "@/lib/repositories/portal-repository.mock"
import type { PortalRepository } from "@/lib/repositories/portal-repository.types"
import type {
  DocumentMetadataCreatePayload,
  DocumentsData,
  DocumentsQuery,
  Employee,
  EmployeesQuery,
  ProfileData,
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

    return {
      documentId: created.id,
      objectKey: `documents/${payload.createdBy}/${created.id}/${payload.fileName}`,
      uploadUrl: `mock://upload/${created.id}`,
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
      })
      .from(users)
      .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
      .where(eq(users.id, userId))

    if (!row) return null
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
      department: row.departmentId ?? fallback.department,
      departmentId: row.departmentId,
      phone: row.phone ?? fallback.phone,
      email: row.email,
      office: row.office ?? fallback.office,
      avatarUrl: row.avatarUrl ?? undefined,
      presence:
        row.presence === "away" || row.presence === "offline" || row.presence === "office"
          ? row.presence
          : "office",
    })
  },

  async updateProfile(userId: string, payload: ProfileUpdatePayload): Promise<ProfileData> {
    await db
      .update(users)
      .set({
        firstName: payload.firstName,
        lastName: payload.lastName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

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
}
