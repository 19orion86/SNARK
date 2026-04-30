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
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).optional(),
  avatarUrl: z.string().trim().url().optional(),
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
  avatarUrl: z.string().optional(),
  presence: z.enum(["office", "away", "offline"]),
  tabs: z.array(
    z.object({
      id: z.enum(["tasks", "vacation", "evaluations", "kpi", "payslips"]),
      label: z.string(),
      icon: z.string(),
    })
  ),
  tasks: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      system: z.string(),
      deadline: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      status: z.enum(["В работе", "Новая", "Запланирована"]),
    })
  ),
  vacations: z.array(
    z.object({
      id: z.number().int(),
      start: z.string(),
      end: z.string(),
      days: z.number().int(),
      status: z.enum(["approved", "pending"]),
      type: z.string(),
    })
  ),
  payslips: z.array(z.string()),
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

export type EmployeesQueryInput = z.infer<typeof employeesQuerySchema>
export type EmployeesResponseOutput = z.infer<typeof employeesResponseSchema>
export type DocumentsQueryInput = z.infer<typeof documentsQuerySchema>
export type DocumentsResponseOutput = z.infer<typeof documentsResponseSchema>
