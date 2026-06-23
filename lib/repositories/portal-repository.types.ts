import type {
  AdminDepartmentItem,
  AdminDepartmentUpsertPayload,
  AdminDepartmentsResponse,
  AdminEmployeeItem,
  AdminEmployeeUpsertPayload,
  AdminEmployeesResponse,
  AdminPortalUserCreatePayload,
  AdminPortalUserItem,
  AdminPortalUsersResponse,
  AdminVacationItem,
  BirthdaysData,
  CalendarEvent,
  ContactsData,
  DashboardData,
  DepartmentsTreeResponse,
  DocumentMetadataCreatePayload,
  DocumentMetadataCreateResponse,
  DocumentsQuery,
  DocumentsData,
  Employee,
  EmployeeImportResult,
  EmployeesQuery,
  EventCreatePayload,
  EventsListResponse,
  EventsMonthQuery,
  KnowledgeArticle,
  KnowledgeDetailResponse,
  KnowledgeEditorPayload,
  KnowledgeListQuery,
  KnowledgeListResponse,
  NewEmployeeItem,
  NewsDetailResponse,
  NewsEditorPayload,
  NewsListQuery,
  NewsListResponse,
  ProfileData,
  ProfilePresenceUpdatePayload,
  ProfileUpdatePayload,
  SidebarItem,
  Ticket,
  TicketAdminUpdatePayload,
  TicketCategoriesResponse,
  TicketCategoryItem,
  TicketCategoryUpsertPayload,
  TicketCreatePayload,
  TicketsListResponse,
  TicketsQuery,
  VacationAdminUpdatePayload,
  VacationBalance,
  VacationCreatePayload,
  VacationItem,
  VacationStatus,
} from "@/types/portal"
import type { UserRole } from "@/types/auth"

export interface PortalRepository {
  getDashboardData(userId?: string): Promise<DashboardData>
  getBirthdays(): Promise<BirthdaysData>
  getNewEmployees(): Promise<NewEmployeeItem[]>
  getContactsData(query?: EmployeesQuery): Promise<ContactsData>
  getEmployeeById(id: string): Promise<{ item: Employee | null }>
  getDepartmentsTree(): Promise<DepartmentsTreeResponse>
  listAdminDepartments(): Promise<AdminDepartmentsResponse>
  getAdminDepartmentById(id: string): Promise<{ item: AdminDepartmentItem | null }>
  createDepartment(payload: AdminDepartmentUpsertPayload): Promise<AdminDepartmentItem>
  updateDepartment(
    id: string,
    payload: AdminDepartmentUpsertPayload
  ): Promise<AdminDepartmentItem>
  deleteDepartment(id: string): Promise<void>

  getDocumentsData(
    query?: DocumentsQuery,
    requester?: { role: string; userId?: string; departmentId?: string | null }
  ): Promise<DocumentsData>
  getDocumentById(id: string): Promise<{ item: DocumentsData["documents"][number] | null }>
  createDocumentMetadata(payload: DocumentMetadataCreatePayload & { createdBy: string }): Promise<DocumentMetadataCreateResponse>
  getProfileData(userId?: string): Promise<ProfileData>
  getCurrentUserProfile(userId: string): Promise<ProfileData | null>
  updateProfile(userId: string, payload: ProfileUpdatePayload): Promise<ProfileData>
  updateMyPresence(userId: string, payload: ProfilePresenceUpdatePayload): Promise<ProfileData>
  listAdminEmployees(): Promise<AdminEmployeesResponse>
  createAdminEmployee(payload: AdminEmployeeUpsertPayload): Promise<AdminEmployeeItem>
  updateAdminEmployee(id: string, payload: AdminEmployeeUpsertPayload): Promise<AdminEmployeeItem>
  hideAdminEmployee(id: string, hidden: boolean): Promise<AdminEmployeeItem>
  deleteAdminEmployee(id: string): Promise<void>
  importEmployees(rows: AdminEmployeeUpsertPayload[]): Promise<EmployeeImportResult>
  listAdminPortalUsers(): Promise<AdminPortalUsersResponse>
  getAdminPortalUserById(id: string): Promise<AdminPortalUserItem | null>
  createAdminPortalUser(payload: AdminPortalUserCreatePayload): Promise<AdminPortalUserItem>
  updateAdminPortalUserRole(id: string, role: UserRole): Promise<AdminPortalUserItem>
  updateAdminPortalUserCredentials(
    id: string,
    payload: { email?: string; password?: string }
  ): Promise<AdminPortalUserItem>
  updateAdminPortalUserStatus(id: string, isActive: boolean): Promise<AdminPortalUserItem>
  deleteAdminPortalUser(id: string): Promise<void>
  getNewsList(query?: NewsListQuery, includeDrafts?: boolean): Promise<NewsListResponse>
  getNewsById(id: string, includeDrafts?: boolean): Promise<NewsDetailResponse>
  createNews(payload: NewsEditorPayload & { authorId: string }): Promise<NewsDetailResponse["item"]>
  updateNews(id: string, payload: NewsEditorPayload): Promise<NewsDetailResponse["item"]>
  deleteNews(id: string): Promise<void>
  getSidebarItems(): Promise<SidebarItem[]>
  listMyTickets(authorId: string, query?: TicketsQuery): Promise<TicketsListResponse>
  listAdminTickets(query?: TicketsQuery): Promise<TicketsListResponse>
  getTicketById(
    id: string,
    requester: { userId: string; role: UserRole }
  ): Promise<{ item: Ticket | null }>
  createTicket(payload: TicketCreatePayload & { authorId: string }): Promise<Ticket>
  updateAdminTicket(id: string, payload: TicketAdminUpdatePayload): Promise<Ticket>
  listTicketCategories(activeOnly?: boolean): Promise<TicketCategoriesResponse>
  createTicketCategory(payload: TicketCategoryUpsertPayload): Promise<TicketCategoryItem>
  updateTicketCategory(
    id: string,
    payload: Partial<TicketCategoryUpsertPayload>
  ): Promise<TicketCategoryItem>
  deleteTicketCategory(id: string): Promise<void>
  listEventsForMonth(query: EventsMonthQuery): Promise<EventsListResponse>
  createEvent(payload: EventCreatePayload & { createdBy: string }): Promise<CalendarEvent>
  deleteEvent(id: string): Promise<void>
  listMyVacations(userId: string): Promise<VacationItem[]>
  getMyVacationBalance(userId: string): Promise<VacationBalance>
  createVacation(
    payload: VacationCreatePayload & { userId: string; daysTotal: number }
  ): Promise<VacationItem>
  listAdminVacations(filter?: { status?: VacationStatus }): Promise<AdminVacationItem[]>
  updateAdminVacation(
    id: string,
    payload: VacationAdminUpdatePayload & { approvedBy: string }
  ): Promise<VacationItem>
  listKnowledgeArticles(
    query?: KnowledgeListQuery,
    includeDrafts?: boolean
  ): Promise<KnowledgeListResponse>
  getKnowledgeArticleById(
    id: string,
    includeDrafts?: boolean
  ): Promise<KnowledgeDetailResponse>
  incrementKnowledgeArticleViews(id: string): Promise<void>
  createKnowledgeArticle(
    payload: KnowledgeEditorPayload & { authorId: string }
  ): Promise<KnowledgeArticle>
  updateKnowledgeArticle(
    id: string,
    payload: KnowledgeEditorPayload
  ): Promise<KnowledgeArticle>
  deleteKnowledgeArticle(id: string): Promise<void>
}
