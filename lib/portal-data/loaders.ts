import "server-only"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import type {
  ContactsData,
  DashboardData,
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

export async function loadDocumentsData(): Promise<DocumentsData> {
  return getPortalRepositoryServer().getDocumentsData()
}

export async function loadProfileData(): Promise<ProfileData> {
  return getPortalRepositoryServer().getProfileData()
}

export async function loadSidebarItems(): Promise<SidebarItem[]> {
  return getPortalRepositoryServer().getSidebarItems()
}
