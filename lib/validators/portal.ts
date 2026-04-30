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

export type EmployeesQueryInput = z.infer<typeof employeesQuerySchema>
export type EmployeesResponseOutput = z.infer<typeof employeesResponseSchema>
