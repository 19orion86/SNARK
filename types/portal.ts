import type { UserRole } from "@/types/auth"

export interface QuickAction {
  label: string
  href: string
  icon: string
}

export interface NewsItem {
  id: string
  title: string
  body: string
  category: string
  coverUrl?: string | null
  isPinned: boolean
  status: "draft" | "published"
  authorId?: string | null
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
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

export interface Department {
  id: string
  name: string
  description?: string | null
  headUserId?: string | null
  parentId?: string | null
  createdAt: string
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
  id: string
  title: string
  category: string
  date: string
  version: string
  size: string
  owner: string
  access: "public" | "restricted"
  departmentId?: string | null
  fileName?: string
  fileUrl?: string
  mimeType?: string
  createdBy?: string
}

export interface DocumentsData {
  documents: DocumentItem[]
  categories: string[]
  total?: number
  page?: number
  limit?: number
}

export interface DocumentsQuery {
  category?: string
  search?: string
  page?: number
  limit?: number
}

export type DocumentsResponse = PaginatedResponse<DocumentItem> & {
  categories: string[]
}

export interface ProfileTab {
  id: "my_profile" | "my_department" | "documents" | "vacation"
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
  id: string
  userId: string
  startDate: string
  endDate: string
  daysTotal: number
  daysRemaining: number
  status: "approved" | "pending"
  createdAt: string
}

export interface ProfileData {
  userId?: string
  fullName: string
  firstName?: string
  lastName?: string
  initials: string
  roleTitle: string
  role?: UserRole
  department: string
  departmentId?: string | null
  phone: string
  email: string
  office: string
  avatarUrl?: string
  positionTitle?: string
  presence: "office" | "remote" | "vacation"
  legacyPresence?: "office" | "away" | "offline"
  tabs?: ProfileTab[]
  profileTab?: {
    status: "office" | "remote" | "vacation"
  }
  departmentTab?: {
    departmentName: string
    manager?: {
      id: string
      fullName: string
    } | null
    regulationsDoc?: {
      id: string
      title: string
      downloadUrl?: string
    } | null
    standardsDoc?: {
      id: string
      title: string
      downloadUrl?: string
    } | null
  }
  documentsTab?: {
    jobInstruction?: {
      id: string
      title: string
      downloadUrl?: string
    } | null
  }
  vacationTab?: {
    daysRemaining: number
    nextVacation?: {
      startDate: string
      endDate: string
      daysUntil: number
    } | null
    history: VacationItem[]
  }
  tasks?: ProfileTask[]
  vacations: VacationItem[]
  payslips?: string[]
}

export interface ProfileUpdatePayload {
  phone?: string
  avatarUrl?: string
}

export interface ProfilePresenceUpdatePayload {
  presence: "office" | "remote" | "vacation"
}

export interface CurrentUserResponse {
  profile: ProfileData
}

export interface DocumentMetadataCreatePayload {
  title: string
  category: string
  version?: string
  access: "public" | "restricted"
  departmentId?: string
  fileName: string
  contentType: string
  sizeBytes: number
}

export interface DocumentMetadataCreateResponse {
  documentId: string
  objectKey: string
  uploadUrl: string
  expiresAt: string
}

export interface SidebarItem {
  id: string
  label: string
  icon: string
  description?: string
  href: string
  roles?: UserRole[]
}

export interface AdminEmployeeItem {
  id: string
  fullName: string
  firstName: string
  lastName: string
  middleName?: string | null
  positionTitle: string
  departmentId?: string | null
  departmentName: string
  phone?: string | null
  email: string
  birthDate?: string | null
  startDate?: string | null
  welcomeNote?: string | null
  status: "active" | "vacation" | "remote" | "dismissed"
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminEmployeesResponse {
  items: AdminEmployeeItem[]
}

export interface AdminEmployeeUpsertPayload {
  fullName: string
  positionTitle: string
  departmentName: string
  phone?: string
  email: string
  birthDate?: string
  startDate?: string
  welcomeNote?: string
  status?: "active" | "vacation" | "remote" | "dismissed"
}

export interface EmployeeImportErrorItem {
  row: number
  reason: string
}

export interface EmployeeImportResult {
  created: number
  updated: number
  errors: EmployeeImportErrorItem[]
}

export type NewsCategory = "company" | "projects" | "people" | "important"
export type NewsStatus = "draft" | "published"

export interface NewsListQuery {
  category?: "all" | NewsCategory
  page?: number
  limit?: number
}

export interface NewsListItem {
  id: string
  title: string
  body: string
  category: NewsCategory
  coverUrl?: string | null
  isPinned: boolean
  status: NewsStatus
  authorId?: string | null
  authorName: string
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface NewsListResponse {
  items: NewsListItem[]
  total: number
  page: number
  limit: number
}

export interface NewsDetailResponse {
  item: NewsListItem | null
}

export interface NewsEditorPayload {
  title: string
  body: string
  category: NewsCategory
  coverUrl?: string
  isPinned?: boolean
  status?: NewsStatus
  publishedAt?: string
}

export interface NewsCoverUploadPayload {
  fileName: string
  contentType: string
}

export interface NewsCoverUploadResponse {
  uploadUrl: string
  objectKey: string
  fileUrl: string
  expiresAt: string
}
