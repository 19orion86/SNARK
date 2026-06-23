import "server-only"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import type {
  AdminDepartmentsResponse,
  AdminVacationItem,
  BirthdaysData,
  ContactsData,
  DashboardData,
  DepartmentsTreeResponse,
  DocumentsQuery,
  DocumentsData,
  Employee,
  EmployeesQuery,
  EventsListResponse,
  EventsMonthQuery,
  KnowledgeDetailResponse,
  KnowledgeListQuery,
  KnowledgeListResponse,
  NewEmployeeItem,
  NewsDetailResponse,
  NewsListQuery,
  NewsListResponse,
  ProfileData,
  SidebarItem,
  TicketsListResponse,
  TicketsQuery,
  TicketCategoriesResponse,
  VacationBalance,
  VacationItem,
  VacationStatus,
} from "@/types/portal"

export async function loadDashboardData(userId?: string): Promise<DashboardData> {
  return getPortalRepositoryServer().getDashboardData(userId)
}

export async function loadBirthdaysData(): Promise<BirthdaysData> {
  return getPortalRepositoryServer().getBirthdays()
}

export async function loadNewEmployees(): Promise<NewEmployeeItem[]> {
  return getPortalRepositoryServer().getNewEmployees()
}

export async function loadContactsData(query?: EmployeesQuery): Promise<ContactsData> {
  return getPortalRepositoryServer().getContactsData(query)
}

export async function loadDepartmentsTree(): Promise<DepartmentsTreeResponse> {
  return getPortalRepositoryServer().getDepartmentsTree()
}

export async function loadAdminDepartments(): Promise<AdminDepartmentsResponse> {
  return getPortalRepositoryServer().listAdminDepartments()
}

export async function loadEmployeeById(id: string): Promise<{ item: Employee | null }> {
  return getPortalRepositoryServer().getEmployeeById(id)
}

export async function loadDocumentsData(
  query?: DocumentsQuery,
  requester?: { role: string; userId?: string; departmentId?: string | null }
): Promise<DocumentsData> {
  return getPortalRepositoryServer().getDocumentsData(query, requester)
}

export async function loadProfileData(userId?: string): Promise<ProfileData> {
  return getPortalRepositoryServer().getProfileData(userId)
}

export async function loadSidebarItems(): Promise<SidebarItem[]> {
  return getPortalRepositoryServer().getSidebarItems()
}

export async function loadNewsData(query?: NewsListQuery): Promise<NewsListResponse> {
  return getPortalRepositoryServer().getNewsList(query)
}

export async function loadNewsById(id: string): Promise<NewsDetailResponse> {
  return getPortalRepositoryServer().getNewsById(id)
}

export async function loadMyTickets(
  authorId: string,
  query?: TicketsQuery
): Promise<TicketsListResponse> {
  return getPortalRepositoryServer().listMyTickets(authorId, query)
}

export async function loadAdminTickets(query?: TicketsQuery): Promise<TicketsListResponse> {
  return getPortalRepositoryServer().listAdminTickets(query)
}

export async function loadTicketCategories(activeOnly = true): Promise<TicketCategoriesResponse> {
  return getPortalRepositoryServer().listTicketCategories(activeOnly)
}

export async function loadEventsForMonth(query: EventsMonthQuery): Promise<EventsListResponse> {
  return getPortalRepositoryServer().listEventsForMonth(query)
}

export async function loadMyVacations(userId: string): Promise<VacationItem[]> {
  return getPortalRepositoryServer().listMyVacations(userId)
}

export async function loadVacationBalance(userId: string): Promise<VacationBalance> {
  return getPortalRepositoryServer().getMyVacationBalance(userId)
}

export async function loadAdminVacations(filter?: {
  status?: VacationStatus
}): Promise<AdminVacationItem[]> {
  return getPortalRepositoryServer().listAdminVacations(filter)
}

export async function loadKnowledgeArticles(
  query?: KnowledgeListQuery,
  includeDrafts = false
): Promise<KnowledgeListResponse> {
  return getPortalRepositoryServer().listKnowledgeArticles(query, includeDrafts)
}

export async function loadKnowledgeArticleById(
  id: string,
  includeDrafts = false
): Promise<KnowledgeDetailResponse> {
  return getPortalRepositoryServer().getKnowledgeArticleById(id, includeDrafts)
}
