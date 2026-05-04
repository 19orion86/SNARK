import { z } from "zod"

export const employeesQuerySchema = z.object({
  search: z.string().trim().optional(),
  department: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const employeeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  position: z.string(),
  department: z.string(),
  phone: z.string(),
  email: z.string().email(),
  office: z.string(),
  status: z.enum(["online", "away", "offline"]),
  avatar: z.string(),
})

export const employeesResponseSchema = z.object({
  items: z.array(employeeSchema),
  departments: z.array(z.string()),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
})

export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.string().optional(),
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
  avatarUrl: z.string().trim().url().optional(),
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
          status: z.enum(["approved", "pending"]),
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
      status: z.enum(["approved", "pending"]),
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
})

export const adminEmployeesResponseSchema = z.object({
  items: z.array(adminEmployeeItemSchema),
})

export const adminEmployeeUpsertSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  positionTitle: z.string().trim().min(1).max(150),
  departmentName: z.string().trim().min(1).max(150),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email(),
  birthDate: z.string().date().optional(),
  startDate: z.string().date().optional(),
  welcomeNote: z.string().trim().max(2000).optional(),
  status: adminEmployeeStatusSchema.optional(),
})

export const adminEmployeeHideSchema = z.object({
  hidden: z.boolean(),
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

export const newsCategorySchema = z.enum(["company", "projects", "people", "important"])
export const newsStatusSchema = z.enum(["draft", "published"])

export const newsListQuerySchema = z.object({
  category: z.enum(["all", "company", "projects", "people", "important"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const newsEditorSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1),
  category: newsCategorySchema,
  coverUrl: z.string().trim().url().optional(),
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

export type EmployeesQueryInput = z.infer<typeof employeesQuerySchema>
export type EmployeesResponseOutput = z.infer<typeof employeesResponseSchema>
export type DocumentsQueryInput = z.infer<typeof documentsQuerySchema>
export type DocumentsResponseOutput = z.infer<typeof documentsResponseSchema>
export type AdminEmployeeUpsertInput = z.infer<typeof adminEmployeeUpsertSchema>
export type NewsListQueryInput = z.infer<typeof newsListQuerySchema>
export type NewsEditorInput = z.infer<typeof newsEditorSchema>
