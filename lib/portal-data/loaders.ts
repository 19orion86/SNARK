import "server-only"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import type {
  ContactsData,
  DashboardData,
  DocumentsQuery,
  DocumentsData,
  EmployeesQuery,
  NewsDetailResponse,
  NewsListQuery,
  NewsListResponse,
  ProfileData,
  SidebarItem,
} from "@/types/portal"

export async function loadDashboardData(): Promise<DashboardData> {
  return getPortalRepositoryServer().getDashboardData()
}

export async function loadContactsData(query?: EmployeesQuery): Promise<ContactsData> {
  return getPortalRepositoryServer().getContactsData(query)
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
