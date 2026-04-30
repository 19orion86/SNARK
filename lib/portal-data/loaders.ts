import "server-only"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import type {
  ContactsData,
  DashboardData,
  DocumentsQuery,
  DocumentsData,
  EmployeesQuery,
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
