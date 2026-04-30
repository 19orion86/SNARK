import type {
  ContactsData,
  DashboardData,
  DocumentMetadataCreatePayload,
  DocumentMetadataCreateResponse,
  DocumentsQuery,
  DocumentsData,
  EmployeesQuery,
  ProfileData,
  ProfileUpdatePayload,
  SidebarItem,
} from "@/types/portal"

export interface PortalRepository {
  getDashboardData(): Promise<DashboardData>
  getContactsData(query?: EmployeesQuery): Promise<ContactsData>
  getDocumentsData(
    query?: DocumentsQuery,
    requester?: { role: string; userId?: string; departmentId?: string | null }
  ): Promise<DocumentsData>
  getDocumentById(id: string): Promise<{ item: DocumentsData["documents"][number] | null }>
  createDocumentMetadata(payload: DocumentMetadataCreatePayload & { createdBy: string }): Promise<DocumentMetadataCreateResponse>
  getProfileData(userId?: string): Promise<ProfileData>
  getCurrentUserProfile(userId: string): Promise<ProfileData | null>
  updateProfile(userId: string, payload: ProfileUpdatePayload): Promise<ProfileData>
  getSidebarItems(): Promise<SidebarItem[]>
}
