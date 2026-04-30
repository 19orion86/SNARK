import type { UserRole } from "@/types/auth"

export interface QuickAction {
  label: string
  href: string
  icon: string
}

export interface NewsItem {
  id: number
  title: string
  date: string
  category: string
  isUrgent: boolean
}

export interface BirthdayPerson {
  name: string
  department: string
  avatar: string
}

export interface TaskItem {
  title: string
  deadline: string
  priority: "high" | "medium" | "low"
}

export interface ServiceCardItem {
  title: string
  description: string
  icon: string
  color: string
}

export interface DashboardData {
  welcomeName: string
  quickActions: QuickAction[]
  recentNews: NewsItem[]
  todayBirthdays: BirthdayPerson[]
  myTasks: TaskItem[]
  serviceCards: ServiceCardItem[]
}

export interface Employee {
  id: number
  name: string
  position: string
  department: string
  phone: string
  email: string
  office: string
  status: "online" | "away" | "offline"
  avatar: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface ApiError {
  error: string
  code?: string
  details?: string
}

export interface EmployeesQuery {
  search?: string
  department?: string
  page?: number
  limit?: number
}

export type EmployeesResponse = PaginatedResponse<Employee> & {
  departments: string[]
}

export interface ContactsData {
  employees: Employee[]
  departments: string[]
  total?: number
  page?: number
  limit?: number
}

export interface DocumentItem {
  id: number
  title: string
  category: string
  date: string
  version: string
  size: string
  owner: string
  access: "all" | "restricted"
}

export interface DocumentsData {
  documents: DocumentItem[]
  categories: string[]
}

export interface ProfileTab {
  id: "tasks" | "vacation" | "evaluations" | "kpi" | "payslips"
  label: string
  icon: string
}

export interface ProfileTask {
  id: number
  title: string
  system: string
  deadline: string
  priority: "high" | "medium" | "low"
  status: "В работе" | "Новая" | "Запланирована"
}

export interface VacationItem {
  id: number
  start: string
  end: string
  days: number
  status: "approved" | "pending"
  type: string
}

export interface ProfileData {
  fullName: string
  initials: string
  roleTitle: string
  department: string
  phone: string
  email: string
  office: string
  presence: "office" | "away" | "offline"
  tabs: ProfileTab[]
  tasks: ProfileTask[]
  vacations: VacationItem[]
  payslips: string[]
}

export interface SidebarItem {
  id: string
  label: string
  icon: string
  description?: string
  href: string
  roles?: UserRole[]
}
