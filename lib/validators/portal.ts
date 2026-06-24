import { z } from "zod"
import type { DepartmentTreeNode } from "@/types/portal"

export const employeesQuerySchema = z.object({
  search: z.string().trim().optional(),
  department: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
})

export const employeeSchema = z.object({
  id: z.number().int(),
  userId: z.string().uuid(),
  name: z.string(),
  position: z.string(),
  department: z.string(),
  phone: z.string(),
  email: z.string().email(),
  office: z.string(),
  status: z.enum(["online", "away", "offline"]),
  avatar: z.string(),
  avatarUrl: z.string().optional(),
  inn: z.string().nullable().optional(),
  snils: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  citizenship: z.string().nullable().optional(),
  anniversaryYears: z.number().int().nullable().optional(),
  professions: z.string().nullable().optional(),
  education: z.string().nullable().optional(),
  managerPosition: z.string().nullable().optional(),
  contractEndDate: z.string().nullable().optional(),
  isContractor: z.boolean(),
  hireDate: z.string().nullable().optional(),
  welcomeText: z.string().nullable().optional(),
  isNew: z.boolean(),
  manager: z
    .object({
      id: z.string().uuid(),
      fullName: z.string(),
      positionTitle: z.string().nullable(),
    })
    .nullable()
    .optional(),
})

export const employeesResponseSchema = z.object({
  items: z.array(employeeSchema),
  departments: z.array(z.string()),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
})

export const employeeDetailResponseSchema = z.object({
  item: employeeSchema.nullable(),
})

export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.string().optional(),
})

export const birthdayPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  department: z.string(),
  position: z.string(),
  avatar: z.string(),
  avatarUrl: z.string().nullable().optional(),
  birthDate: z.string(),
  age: z.number().int().min(0).max(150),
})

export const birthdaysResponseSchema = z.object({
  today: z.array(birthdayPersonSchema),
  thisWeek: z.array(birthdayPersonSchema),
  upcoming: z.array(birthdayPersonSchema),
})

export const departmentTreeHeadSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  positionTitle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

export const departmentTreeNodeSchema: z.ZodType<DepartmentTreeNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    code: z.string().nullable(),
    description: z.string().nullable(),
    head: departmentTreeHeadSchema.nullable(),
    employeeCount: z.number().int().nonnegative(),
    plannedHeadcount: z.number().int().nonnegative().nullable(),
    children: z.array(departmentTreeNodeSchema),
  })
)

export const departmentsTreeResponseSchema = z.object({
  departments: z.array(departmentTreeNodeSchema),
})

export const adminDepartmentUpsertSchema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(255),
  code: z
    .string()
    .trim()
    .max(50)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  description: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  parentId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  headUserId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  contactEmail: z
    .union([
      z.literal("").transform(() => null),
      z.string().trim().email("Некорректный email").max(255),
      z.null(),
    ])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
})

export const adminDepartmentItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  parentId: z.string().uuid().nullable(),
  parentName: z.string().nullable(),
  headUserId: z.string().uuid().nullable(),
  headName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  employeeCount: z.number().int().nonnegative(),
})

export const adminDepartmentsResponseSchema = z.object({
  items: z.array(adminDepartmentItemSchema),
})

export type AdminDepartmentUpsertInput = z.infer<typeof adminDepartmentUpsertSchema>

export const newEmployeeItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
  department: z.string(),
  avatar: z.string(),
  avatarUrl: z.string().nullable().optional(),
  startDate: z.string(),
  welcomeText: z.string().nullable().optional(),
})

export const newEmployeesResponseSchema = z.object({
  items: z.array(newEmployeeItemSchema),
})

export const documentsQuerySchema = z.object({
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const documentItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  date: z.string(),
  version: z.string(),
  size: z.string(),
  owner: z.string(),
  access: z.enum(["public", "restricted"]),
  departmentId: z.string().nullable().optional(),
  fileName: z.string().optional(),
  fileUrl: z.string().optional(),
  mimeType: z.string().optional(),
  createdBy: z.string().optional(),
})

export const documentsResponseSchema = z.object({
  items: z.array(documentItemSchema),
  categories: z.array(z.string()),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
})

export const profileUpdateSchema = z.object({
  phone: z.string().trim().max(40).optional(),
  avatarUrl: z
    .string()
    .trim()
    .max(2048)
    .refine(
      (value) =>
        value.length === 0 ||
        /^https?:\/\/.+/i.test(value) ||
        value.startsWith("/uploads/avatars/"),
      { message: "Некорректная ссылка на фото" }
    )
    .optional(),
})

export const profilePresenceSchema = z.object({
  presence: z.enum(["office", "remote", "vacation"]),
})

export const profileDataSchema = z.object({
  userId: z.string().optional(),
  fullName: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  initials: z.string(),
  roleTitle: z.string(),
  role: z.enum(["admin", "hr_manager", "employee"]).optional(),
  department: z.string(),
  departmentId: z.string().nullable().optional(),
  phone: z.string(),
  email: z.string().email(),
  office: z.string(),
  positionTitle: z.string().optional(),
  avatarUrl: z.string().optional(),
  presence: z.enum(["office", "remote", "vacation"]),
  legacyPresence: z.enum(["office", "away", "offline"]).optional(),
  tabs: z
    .array(
      z.object({
        id: z.enum(["my_profile", "my_department", "documents", "vacation"]),
        label: z.string(),
        icon: z.string(),
      })
    )
    .optional(),
  profileTab: z
    .object({
      status: z.enum(["office", "remote", "vacation"]),
    })
    .optional(),
  departmentTab: z
    .object({
      departmentName: z.string(),
      manager: z
        .object({
          id: z.string(),
          fullName: z.string(),
        })
        .nullable()
        .optional(),
      regulationsDoc: z
        .object({
          id: z.string(),
          title: z.string(),
          downloadUrl: z.string().optional(),
        })
        .nullable()
        .optional(),
      standardsDoc: z
        .object({
          id: z.string(),
          title: z.string(),
          downloadUrl: z.string().optional(),
        })
        .nullable()
        .optional(),
    })
    .optional(),
  documentsTab: z
    .object({
      jobInstruction: z
        .object({
          id: z.string(),
          title: z.string(),
          downloadUrl: z.string().optional(),
        })
        .nullable()
        .optional(),
    })
    .optional(),
  vacationTab: z
    .object({
      daysRemaining: z.number().int(),
      nextVacation: z
        .object({
          startDate: z.string(),
          endDate: z.string(),
          daysUntil: z.number().int(),
        })
        .nullable()
        .optional(),
      history: z.array(
        z.object({
          id: z.string(),
          userId: z.string(),
          startDate: z.string(),
          endDate: z.string(),
          daysTotal: z.number().int(),
          daysRemaining: z.number().int(),
          status: z.enum(["approved", "pending", "rejected"]),
          type: z.enum(["annual", "sick", "unpaid", "maternity"]),
          comment: z.string().nullable(),
          approvedBy: z.string().nullable(),
          createdAt: z.string(),
        })
      ),
    })
    .optional(),
  tasks: z
    .array(
      z.object({
        id: z.number().int(),
        title: z.string(),
        system: z.string(),
        deadline: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        status: z.enum(["В работе", "Новая", "Запланирована"]),
      })
    )
    .optional(),
  vacations: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      daysTotal: z.number().int(),
      daysRemaining: z.number().int(),
      status: z.enum(["approved", "pending", "rejected"]),
      type: z.enum(["annual", "sick", "unpaid", "maternity"]),
      comment: z.string().nullable(),
      approvedBy: z.string().nullable(),
      createdAt: z.string(),
    })
  ),
  payslips: z.array(z.string()).optional(),
})

export const currentUserResponseSchema = z.object({
  profile: profileDataSchema,
})

export const documentMetadataCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  category: z.string().trim().min(1).max(120),
  version: z.string().trim().max(20).optional(),
  access: z.enum(["public", "restricted"]),
  departmentId: z.string().trim().optional(),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  sizeBytes: z.coerce.number().int().positive(),
})

export const documentMetadataCreateResponseSchema = z.object({
  documentId: z.string(),
  objectKey: z.string(),
  uploadUrl: z.string(),
  expiresAt: z.string(),
})

export const adminEmployeeStatusSchema = z.enum(["active", "vacation", "remote", "dismissed"])

export const adminEmployeeItemSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().nullable().optional(),
  positionTitle: z.string(),
  departmentId: z.string().uuid().nullable().optional(),
  departmentName: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().email(),
  birthDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  welcomeNote: z.string().nullable().optional(),
  status: adminEmployeeStatusSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  inn: z.string().nullable().optional(),
  snils: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  citizenship: z.string().nullable().optional(),
  anniversaryYears: z.number().int().nullable().optional(),
  professions: z.string().nullable().optional(),
  education: z.string().nullable().optional(),
  managerPosition: z.string().nullable().optional(),
  contractEndDate: z.string().nullable().optional(),
  isContractor: z.boolean(),
  isNew: z.boolean(),
})

export const adminEmployeesResponseSchema = z.object({
  items: z.array(adminEmployeeItemSchema),
})

const innRegex = /^\d{10,12}$/
const snilsRegex = /^(\d{3}-\d{3}-\d{3} \d{2}|\d{11})$/

export const adminEmployeeUpsertSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  positionTitle: z.string().trim().min(1).max(200),
  departmentName: z.string().trim().max(200).optional().default(""),
  departmentCode: z.string().trim().max(50).optional(),
  departmentEmail: z.string().trim().email().optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().optional(),
  birthDate: z.string().date().optional(),
  startDate: z.string().date().optional(),
  welcomeNote: z.string().trim().max(2000).optional(),
  status: adminEmployeeStatusSchema.optional(),
  inn: z.string().trim().regex(innRegex, "ИНН должен содержать 10–12 цифр").optional(),
  snils: z
    .string()
    .trim()
    .regex(snilsRegex, "СНИЛС должен быть в формате XXX-XXX-XXX XX или 11 цифр")
    .optional(),
  address: z.string().trim().max(500).optional(),
  citizenship: z.string().trim().max(100).optional(),
  anniversaryYears: z.number().int().min(0).max(150).optional(),
  professions: z.string().trim().max(500).optional(),
  education: z.string().trim().max(200).optional(),
  managerPosition: z.string().trim().max(200).optional(),
  contractEndDate: z.string().date().optional(),
  isContractor: z.boolean().optional(),
})

export const adminEmployeeHideSchema = z.object({
  hidden: z.boolean(),
})

const portalUserRoleSchema = z.enum(["admin", "hr_manager", "employee"])

const portalUserPasswordSchema = z.string().min(6, "Пароль не короче 6 символов")

export const adminPortalUserItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: portalUserRoleSchema,
  isActive: z.boolean(),
  departmentName: z.string().nullable(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
})

export const adminPortalUsersResponseSchema = z.object({
  items: z.array(adminPortalUserItemSchema),
})

export const adminPortalUserSingleResponseSchema = z.object({
  item: adminPortalUserItemSchema,
})

export const adminPortalUserCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: portalUserPasswordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: portalUserRoleSchema,
  departmentId: z.string().uuid().optional().nullable(),
})

export const adminPortalUserRoleUpdateSchema = z.object({
  role: portalUserRoleSchema,
})

export const adminPortalUserCredentialsSchema = z
  .object({
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email()]).optional(),
    password: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const emailVal = val.email
    const hasEmail = typeof emailVal === "string" && emailVal.length > 0
    const pwd = val.password
    const hasPassword = pwd !== undefined && pwd.length > 0
    if (!hasEmail && !hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите новый email или пароль",
      })
    }
    if (hasPassword && pwd!.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Пароль не короче 6 символов",
        path: ["password"],
      })
    }
  })

export const adminPortalUserStatusSchema = z.object({
  isActive: z.boolean(),
})

export const employeeImportErrorSchema = z.object({
  row: z.number().int().min(1),
  reason: z.string(),
})

export const employeeImportResponseSchema = z.object({
  created: z.number().int().min(0),
  updated: z.number().int().min(0),
  errors: z.array(employeeImportErrorSchema),
})

export const orgStructurePreviewTreeNodeSchema: z.ZodType<{
  name: string
  plannedHeadcount: number
  children: Array<{ name: string; plannedHeadcount: number; children: unknown[] }>
}> = z.lazy(() =>
  z.object({
    name: z.string(),
    plannedHeadcount: z.number().int().nonnegative(),
    children: z.array(orgStructurePreviewTreeNodeSchema),
  })
)

export const orgStructureDepartmentDiffItemSchema = z.object({
  name: z.string(),
  externalKey: z.string(),
  parentName: z.string().nullable(),
  plannedHeadcount: z.number().int().nonnegative(),
  action: z.enum(["create", "update", "unchanged"]),
})

export const orgStructureEmployeeDiffItemSchema = z.object({
  fullName: z.string(),
  departmentName: z.string(),
  positionTitle: z.string(),
  hireDate: z.string().optional(),
  action: z.enum(["create", "update", "unchanged"]),
})

export const orgStructureImportPreviewSchema = z.object({
  stats: z.object({
    departments: z.number().int().nonnegative(),
    positions: z.number().int().nonnegative(),
    employees: z.number().int().nonnegative(),
  }),
  warnings: z.array(z.string()),
  tree: z.array(orgStructurePreviewTreeNodeSchema),
  departmentDiff: z.array(orgStructureDepartmentDiffItemSchema),
  employeeDiff: z.array(orgStructureEmployeeDiffItemSchema),
})

export const orgStructureImportResultSchema = z.object({
  departmentsCreated: z.number().int().min(0),
  departmentsUpdated: z.number().int().min(0),
  employeesCreated: z.number().int().min(0),
  employeesUpdated: z.number().int().min(0),
  employeesNotFound: z.number().int().min(0),
  warnings: z.array(z.string()),
})

export const newsCategorySchema = z.enum(["company", "projects", "people", "important"])
export const newsStatusSchema = z.enum(["draft", "published"])

export const newsListQuerySchema = z.object({
  category: z.enum(["all", "company", "projects", "people", "important"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const newsEditorSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1),
  category: newsCategorySchema,
  coverUrl: z
    .union([z.string().trim().url(), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  isPinned: z.boolean().default(false),
  status: newsStatusSchema.default("draft"),
  publishedAt: z.string().datetime().optional(),
})

export const newsListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  category: newsCategorySchema,
  coverUrl: z.string().nullable().optional(),
  isPinned: z.boolean(),
  status: newsStatusSchema,
  authorId: z.string().uuid().nullable().optional(),
  authorName: z.string(),
  publishedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const newsListResponseSchema = z.object({
  items: z.array(newsListItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
})

export const newsDetailResponseSchema = z.object({
  item: newsListItemSchema.nullable(),
})

export const newsCoverUploadSchema = z.object({
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
})

export const newsCoverUploadResponseSchema = z.object({
  uploadUrl: z.string(),
  objectKey: z.string(),
  fileUrl: z.string(),
  expiresAt: z.string(),
})

export const ticketCategorySlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[a-z0-9_-]+$/, "Код: латиница, цифры, _ и -")

export const ticketCategoryUpsertSchema = z.object({
  slug: ticketCategorySlugSchema,
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
})

export const ticketCategoryItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const ticketCategoriesResponseSchema = z.object({
  items: z.array(ticketCategoryItemSchema),
})

export const ticketCategoryEnum = ticketCategorySlugSchema
export const ticketStatusEnum = z.enum(["new", "in_progress", "resolved", "closed"])
export const ticketPriorityEnum = z.enum(["low", "medium", "high", "critical"])

export const ticketsListQuerySchema = z.object({
  status: z.union([ticketStatusEnum, z.literal("all")]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const ticketCreateSchema = z.object({
  category: ticketCategoryEnum,
  subject: z.string().trim().min(1, "Укажите тему").max(200),
  description: z.string().trim().max(5000).optional(),
  priority: ticketPriorityEnum.default("medium"),
})

export const ticketAdminUpdateSchema = z
  .object({
    status: ticketStatusEnum.optional(),
    assigneeId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.assigneeId !== undefined, {
    message: "Нужно указать хотя бы одно поле",
  })

export const ticketSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string(),
  category: ticketCategoryEnum,
  subject: z.string(),
  description: z.string().nullable(),
  status: ticketStatusEnum,
  priority: ticketPriorityEnum,
  assigneeId: z.string().uuid().nullable(),
  assigneeName: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const ticketsListResponseSchema = z.object({
  items: z.array(ticketSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
})

export const ticketDetailResponseSchema = z.object({
  item: ticketSchema.nullable(),
})

export const eventCategoryEnum = z.enum([
  "meeting",
  "birthday",
  "corporate",
  "deadline",
  "holiday",
])

export const eventsMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Укажите месяц в формате YYYY-MM"),
  category: z.union([eventCategoryEnum, z.literal("all")]).optional(),
})

export const eventCreateSchema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(200),
  description: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
  startAt: z.string().datetime({ message: "Некорректная дата начала" }),
  endAt: z
    .string()
    .datetime({ message: "Некорректная дата окончания" })
    .nullable()
    .optional(),
  location: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  category: eventCategoryEnum,
  isAllDay: z.boolean().optional().default(false),
})

export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startAt: z.string(),
  endAt: z.string().nullable(),
  location: z.string().nullable(),
  category: eventCategoryEnum,
  isAllDay: z.boolean(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  isVirtual: z.boolean(),
})

export const eventsListResponseSchema = z.object({
  items: z.array(calendarEventSchema),
  month: z.string(),
})

export const eventDetailResponseSchema = z.object({
  item: calendarEventSchema.nullable(),
})

export const vacationTypeEnum = z.enum(["annual", "sick", "unpaid", "maternity"])
export const vacationStatusEnum = z.enum(["pending", "approved", "rejected"])

export const vacationCreateSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD"),
    type: vacationTypeEnum,
    comment: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable()
      .transform((value) => (value && value.length > 0 ? value : null)),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "Дата окончания должна быть позже или равна дате начала",
    path: ["endDate"],
  })

export const vacationAdminUpdateSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  comment: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
})

export const vacationItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  daysTotal: z.number().int(),
  daysRemaining: z.number().int(),
  status: vacationStatusEnum,
  type: vacationTypeEnum,
  comment: z.string().nullable(),
  approvedBy: z.string().uuid().nullable(),
  createdAt: z.string(),
})

export const vacationBalanceSchema = z.object({
  annual: z.number().int().min(0),
  used: z.number().int().min(0),
  remaining: z.number().int(),
})

export const vacationsListResponseSchema = z.object({
  items: z.array(vacationItemSchema),
})

export const adminVacationsListQuerySchema = z.object({
  status: vacationStatusEnum.optional(),
})

export const adminVacationItemSchema = vacationItemSchema.extend({
  authorName: z.string(),
  authorDepartment: z.string().nullable(),
})

export const adminVacationsListResponseSchema = z.object({
  items: z.array(adminVacationItemSchema),
})

export type EmployeesQueryInput = z.infer<typeof employeesQuerySchema>
export type EmployeesResponseOutput = z.infer<typeof employeesResponseSchema>
export type DocumentsQueryInput = z.infer<typeof documentsQuerySchema>
export type DocumentsResponseOutput = z.infer<typeof documentsResponseSchema>
export type AdminEmployeeUpsertInput = z.infer<typeof adminEmployeeUpsertSchema>
export type NewsListQueryInput = z.infer<typeof newsListQuerySchema>
export type NewsEditorInput = z.infer<typeof newsEditorSchema>
export type TicketsListQueryInput = z.infer<typeof ticketsListQuerySchema>
export type TicketCreateInput = z.infer<typeof ticketCreateSchema>
export type TicketAdminUpdateInput = z.infer<typeof ticketAdminUpdateSchema>
export type EventsMonthQueryInput = z.infer<typeof eventsMonthQuerySchema>
export type EventCreateInput = z.infer<typeof eventCreateSchema>
export type VacationCreateInput = z.infer<typeof vacationCreateSchema>
export type VacationAdminUpdateInput = z.infer<typeof vacationAdminUpdateSchema>
export type AdminVacationsListQueryInput = z.infer<typeof adminVacationsListQuerySchema>

export const knowledgeCategoryEnum = z.enum(["onboarding", "it", "hr", "safety", "general"])

export const knowledgeListQuerySchema = z.object({
  category: z.union([z.literal("all"), knowledgeCategoryEnum]).default("all"),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const knowledgeEditorSchema = z.object({
  title: z.string().trim().min(1, "Укажите заголовок").max(255),
  content: z.string().trim().min(1, "Текст статьи не может быть пустым"),
  category: knowledgeCategoryEnum,
  tags: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
  isPublished: z.boolean().default(false),
})

export const knowledgeArticleSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  category: knowledgeCategoryEnum,
  tags: z.array(z.string()),
  authorId: z.string().uuid().nullable(),
  authorName: z.string(),
  isPublished: z.boolean(),
  viewsCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const knowledgeListResponseSchema = z.object({
  items: z.array(knowledgeArticleSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
})

export const knowledgeDetailResponseSchema = z.object({
  item: knowledgeArticleSchema.nullable(),
})

export type KnowledgeListQueryInput = z.infer<typeof knowledgeListQuerySchema>
export type KnowledgeEditorInput = z.infer<typeof knowledgeEditorSchema>

export const taskStatusEnum = z.enum(["new", "in_progress", "review", "done", "cancelled"])
export const taskPriorityEnum = z.enum(["low", "medium", "high", "critical"])

export const tasksListQuerySchema = z.object({
  status: z.enum(["new", "in_progress", "review", "done", "cancelled", "all"]).optional(),
  assigneeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(5000).optional().nullable(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
})

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
})

export const portalTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusEnum,
  priority: taskPriorityEnum,
  assigneeId: z.string().uuid().nullable(),
  assigneeName: z.string().nullable(),
  creatorId: z.string().uuid(),
  creatorName: z.string(),
  departmentId: z.string().uuid().nullable(),
  departmentName: z.string().nullable(),
  dueDate: z.string().nullable(),
  protocolActionItemId: z.number().int().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const tasksListResponseSchema = z.object({
  items: z.array(portalTaskSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
})

export const taskDetailResponseSchema = z.object({
  item: portalTaskSchema.nullable(),
})

export const chatChannelTypeEnum = z.enum(["direct", "group", "department"])

export const chatChannelCreateSchema = z.object({
  type: chatChannelTypeEnum,
  name: z.string().trim().max(200).optional().nullable(),
  memberIds: z.array(z.string().uuid()).default([]),
  departmentId: z.string().uuid().optional().nullable(),
})

export const chatMessageCreateSchema = z.object({
  body: z.string().trim().min(1).max(10000),
})

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string(),
  body: z.string(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
})

export const chatChannelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  type: chatChannelTypeEnum,
  departmentId: z.string().uuid().nullable(),
  createdBy: z.string().uuid().nullable(),
  memberCount: z.number().int().min(0),
  unreadCount: z.number().int().min(0),
  lastMessage: chatMessageSchema.nullable(),
  peerId: z.string().uuid().nullable().optional(),
  peerName: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const chatChannelsListResponseSchema = z.object({
  items: z.array(chatChannelSchema),
})

export const chatMessagesListResponseSchema = z.object({
  items: z.array(chatMessageSchema),
  channelId: z.string().uuid(),
})

export const protocolUploadFormSchema = z.object({
  title: z.string().trim().min(1).max(500),
  meetingDate: z.string().trim().min(1),
  participants: z.string().trim().min(1),
})
