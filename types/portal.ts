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
  id: string
  name: string
  department: string
  position: string
  avatar: string
  avatarUrl?: string | null
  birthDate: string
  age: number
}

export interface BirthdaysData {
  today: BirthdayPerson[]
  thisWeek: BirthdayPerson[]
  upcoming: BirthdayPerson[]
}

export interface NewEmployeeItem {
  id: string
  name: string
  position: string
  department: string
  avatar: string
  avatarUrl?: string | null
  startDate: string
  welcomeText?: string | null
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
  href: string
}

export interface DashboardData {
  welcomeName: string
  quickActions: QuickAction[]
  recentNews: NewsItem[]
  birthdays: BirthdaysData
  newEmployees: NewEmployeeItem[]
  myTasks: TaskItem[]
  serviceCards: ServiceCardItem[]
}

export interface Employee {
  id: number
  userId: string
  name: string
  position: string
  department: string
  phone: string
  email: string
  office: string
  status: "online" | "away" | "offline"
  avatar: string
  avatarUrl?: string

  inn?: string | null
  snils?: string | null
  birthDate?: string | null
  address?: string | null
  citizenship?: string | null
  anniversaryYears?: number | null
  professions?: string | null
  education?: string | null
  managerPosition?: string | null
  contractEndDate?: string | null
  isContractor: boolean
  hireDate?: string | null
  welcomeText?: string | null
  isNew: boolean
  manager?: {
    id: string
    fullName: string
    positionTitle: string | null
  } | null
}

export interface Department {
  id: string
  name: string
  code?: string | null
  contactEmail?: string | null
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

export type VacationType = "annual" | "sick" | "unpaid" | "maternity"
export type VacationStatus = "pending" | "approved" | "rejected"

export interface VacationItem {
  id: string
  userId: string
  startDate: string
  endDate: string
  daysTotal: number
  daysRemaining: number
  status: VacationStatus
  type: VacationType
  comment: string | null
  approvedBy: string | null
  createdAt: string
}

export interface VacationBalance {
  annual: number
  used: number
  remaining: number
}

export interface VacationCreatePayload {
  startDate: string
  endDate: string
  type: VacationType
  comment?: string | null
}

export interface VacationAdminUpdatePayload {
  status: "approved" | "rejected"
  comment?: string | null
}

export interface AdminVacationItem extends VacationItem {
  authorName: string
  authorDepartment: string | null
}

export interface VacationsListResponse {
  items: VacationItem[]
}

export interface AdminVacationsListResponse {
  items: AdminVacationItem[]
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

export interface DepartmentTreeHead {
  id: string
  fullName: string
  positionTitle: string | null
  avatarUrl: string | null
}

export interface DepartmentTreeNode {
  id: string
  name: string
  code: string | null
  description: string | null
  head: DepartmentTreeHead | null
  employeeCount: number
  children: DepartmentTreeNode[]
}

export interface DepartmentsTreeResponse {
  departments: DepartmentTreeNode[]
}

export interface AdminDepartmentItem {
  id: string
  name: string
  code: string | null
  description: string | null
  parentId: string | null
  parentName: string | null
  headUserId: string | null
  headName: string | null
  contactEmail: string | null
  employeeCount: number
}

export interface AdminDepartmentsResponse {
  items: AdminDepartmentItem[]
}

export interface AdminDepartmentUpsertPayload {
  name: string
  code?: string | null
  description?: string | null
  parentId?: string | null
  headUserId?: string | null
  contactEmail?: string | null
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
  inn?: string | null
  snils?: string | null
  address?: string | null
  citizenship?: string | null
  anniversaryYears?: number | null
  professions?: string | null
  education?: string | null
  managerPosition?: string | null
  contractEndDate?: string | null
  isContractor: boolean
  isNew: boolean
}

export interface AdminEmployeesResponse {
  items: AdminEmployeeItem[]
}

export interface AdminEmployeeUpsertPayload {
  fullName: string
  positionTitle: string
  departmentName: string
  departmentCode?: string
  departmentEmail?: string
  phone?: string
  email?: string
  birthDate?: string
  startDate?: string
  welcomeNote?: string
  status?: "active" | "vacation" | "remote" | "dismissed"
  inn?: string
  snils?: string
  address?: string
  citizenship?: string
  anniversaryYears?: number
  professions?: string
  education?: string
  managerPosition?: string
  contractEndDate?: string
  isContractor?: boolean
}

export interface AdminPortalUserItem {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  isActive: boolean
  departmentName: string | null
  createdAt: string
  lastLoginAt: string | null
}

export interface AdminPortalUsersResponse {
  items: AdminPortalUserItem[]
}

export interface AdminPortalUserCreatePayload {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
  departmentId?: string | null
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

export type TicketCategory = string

export interface TicketCategoryItem {
  id: string
  slug: string
  label: string
  description: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TicketCategoriesResponse {
  items: TicketCategoryItem[]
}

export interface TicketCategoryUpsertPayload {
  slug: string
  label: string
  description?: string | null
  isActive?: boolean
  sortOrder?: number
}
export type TicketStatus = "new" | "in_progress" | "resolved" | "closed"
export type TicketPriority = "low" | "medium" | "high" | "critical"

export interface Ticket {
  id: string
  authorId: string
  authorName: string
  category: TicketCategory
  subject: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string | null
  assigneeName: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TicketsQuery {
  status?: TicketStatus | "all"
  page?: number
  limit?: number
}

export interface TicketsListResponse {
  items: Ticket[]
  total: number
  page: number
  limit: number
}

export interface TicketDetailResponse {
  item: Ticket | null
}

export interface TicketCreatePayload {
  category: TicketCategory
  subject: string
  description?: string | null
  priority: TicketPriority
}

export interface TicketAdminUpdatePayload {
  status?: TicketStatus
  assigneeId?: string | null
}

export type EventCategory = "meeting" | "birthday" | "corporate" | "deadline" | "holiday"

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  startAt: string
  endAt: string | null
  location: string | null
  category: EventCategory
  isAllDay: boolean
  createdBy: string | null
  createdAt: string
  isVirtual: boolean
}

export interface EventsMonthQuery {
  month: string
  category?: EventCategory | "all"
}

export interface EventsListResponse {
  items: CalendarEvent[]
  month: string
}

export interface EventDetailResponse {
  item: CalendarEvent | null
}

export interface EventCreatePayload {
  title: string
  description?: string | null
  startAt: string
  endAt?: string | null
  location?: string | null
  category: EventCategory
  isAllDay?: boolean
}

export type KnowledgeCategory = "onboarding" | "it" | "hr" | "safety" | "general"

export interface KnowledgeArticle {
  id: string
  title: string
  content: string
  category: KnowledgeCategory
  tags: string[]
  authorId: string | null
  authorName: string
  isPublished: boolean
  viewsCount: number
  createdAt: string
  updatedAt: string
}

export interface KnowledgeListQuery {
  category?: "all" | KnowledgeCategory
  search?: string
  page?: number
  limit?: number
}

export interface KnowledgeListResponse {
  items: KnowledgeArticle[]
  total: number
  page: number
  limit: number
}

export interface KnowledgeDetailResponse {
  item: KnowledgeArticle | null
}

export interface KnowledgeEditorPayload {
  title: string
  content: string
  category: KnowledgeCategory
  tags?: string | null
  isPublished?: boolean
}

export type TaskStatus = "new" | "in_progress" | "review" | "done" | "cancelled"
export type TaskPriority = "low" | "medium" | "high" | "critical"

export interface PortalTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  assigneeName: string | null
  creatorId: string
  creatorName: string
  departmentId: string | null
  departmentName: string | null
  dueDate: string | null
  protocolActionItemId: number | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TasksQuery {
  status?: TaskStatus | "all"
  assigneeId?: string
  page?: number
  limit?: number
}

export interface TasksListResponse {
  items: PortalTask[]
  total: number
  page: number
  limit: number
}

export interface TaskDetailResponse {
  item: PortalTask | null
}

export interface TaskCreatePayload {
  title: string
  description?: string | null
  priority?: TaskPriority
  assigneeId?: string | null
  departmentId?: string | null
  dueDate?: string | null
}

export interface TaskUpdatePayload {
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  assigneeId?: string | null
  departmentId?: string | null
  dueDate?: string | null
}

export type ChatChannelType = "direct" | "group" | "department"

export interface ChatChannel {
  id: string
  name: string | null
  type: ChatChannelType
  departmentId: string | null
  createdBy: string | null
  memberCount: number
  unreadCount: number
  lastMessage: ChatMessage | null
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  channelId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
  editedAt: string | null
}

export interface ChatChannelsListResponse {
  items: ChatChannel[]
}

export interface ChatMessagesListResponse {
  items: ChatMessage[]
  channelId: string
}

export interface ChatChannelCreatePayload {
  type: ChatChannelType
  name?: string | null
  memberIds: string[]
  departmentId?: string | null
}

export interface ChatMessageCreatePayload {
  body: string
}

export type ProtocolStatus =
  | "uploaded"
  | "processing"
  | "transcribing"
  | "generating"
  | "completed"
  | "failed"

export interface ProtocolListItem {
  id: number
  title: string
  meetingDate: string
  participants: string[]
  status: ProtocolStatus
  source: string
  createdAt: string
  actionItemsCount?: number
}

export interface ProtocolDetail extends ProtocolListItem {
  protocolText: string | null
  transcriptText: string | null
  agenda: string[]
  decisions: string[]
  actionItems: ProtocolActionItem[]
  errorMessage: string | null
}

export interface ProtocolActionItem {
  id: number
  text: string
  assignee: string
  deadline: string | null
  status: string
  priority: string
}

export interface ProtocolListResponse {
  items: ProtocolListItem[]
  total: number
}

export interface ProtocolUploadPayload {
  title: string
  meetingDate: string
  participants: string[]
}
