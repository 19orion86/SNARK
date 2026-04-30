import type {
  ContactsData,
  DashboardData,
  DocumentsData,
  EmployeesQuery,
  ProfileData,
  SidebarItem,
} from "@/types/portal"

export interface PortalRepository {
  getDashboardData(): Promise<DashboardData>
  getContactsData(query?: EmployeesQuery): Promise<ContactsData>
  getDocumentsData(): Promise<DocumentsData>
  getProfileData(): Promise<ProfileData>
  getSidebarItems(): Promise<SidebarItem[]>
}
