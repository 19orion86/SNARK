export type UserRole = "admin" | "hr_manager" | "employee"

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  departmentId?: string | null
  isActive: boolean
}

export interface Session {
  userId: string
  role: UserRole
  iat: number
  exp: number
}
