import type {
  AdminEmployeeItem,
  AdminEmployeeUpsertPayload,
  AdminEmployeesResponse,
  ContactsData,
  DashboardData,
  DocumentMetadataCreatePayload,
  DocumentMetadataCreateResponse,
  DocumentsQuery,
  DocumentsData,
  EmployeeImportResult,
  EmployeesQuery,
  NewsDetailResponse,
  NewsEditorPayload,
  NewsListQuery,
  NewsListResponse,
  ProfileData,
  ProfilePresenceUpdatePayload,
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
  updateMyPresence(userId: string, payload: ProfilePresenceUpdatePayload): Promise<ProfileData>
  listAdminEmployees(): Promise<AdminEmployeesResponse>
  createAdminEmployee(payload: AdminEmployeeUpsertPayload): Promise<AdminEmployeeItem>
  updateAdminEmployee(id: string, payload: AdminEmployeeUpsertPayload): Promise<AdminEmployeeItem>
  hideAdminEmployee(id: string, hidden: boolean): Promise<AdminEmployeeItem>
  deleteAdminEmployee(id: string): Promise<void>
  importEmployees(rows: AdminEmployeeUpsertPayload[]): Promise<EmployeeImportResult>
  getNewsList(query?: NewsListQuery, includeDrafts?: boolean): Promise<NewsListResponse>
  getNewsById(id: string, includeDrafts?: boolean): Promise<NewsDetailResponse>
  createNews(payload: NewsEditorPayload & { authorId: string }): Promise<NewsDetailResponse["item"]>
  updateNews(id: string, payload: NewsEditorPayload): Promise<NewsDetailResponse["item"]>
  deleteNews(id: string): Promise<void>
  getSidebarItems(): Promise<SidebarItem[]>
}
