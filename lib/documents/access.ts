import type { UserRole } from "@/types/auth"

export interface DocumentRequester {
  role: UserRole | string
  departmentId: string | null
}

export interface DocumentAccessFields {
  access: string
  departmentId?: string | null
}

/**
 * Единое правило видимости документа — то же, что в списке `/documents`
 * (portal-repository.drizzle.ts, getDocumentsData):
 * admin и hr_manager видят всё, остальные — `public` или документы своего отдела.
 * Обязательно для любого маршрута, который отдаёт документ по id.
 */
export function canViewDocument(requester: DocumentRequester, document: DocumentAccessFields): boolean {
  if (requester.role === "admin" || requester.role === "hr_manager") return true
  if (document.access === "public") return true
  return (document.departmentId ?? null) === (requester.departmentId ?? "")
}
