import "server-only"
import { desc, eq, inArray } from "drizzle-orm"
import { isMockDb } from "@/lib/config/mode"
import { formatFullName } from "@/lib/portal-data/format-name"
import type { RagStatus } from "@/lib/validators/assistant"

export interface RagDocumentRow {
  id: string
  title: string
  version: string
  fileName: string
  access: string
  ragStatus: RagStatus
}

/** Документы портала со статусом актуальности для ассистента. */
export async function listRagDocuments(): Promise<RagDocumentRow[]> {
  if (isMockDb()) return []
  const { db } = await import("@/lib/db/client")
  const { documents } = await import("@/lib/db/schema")
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      version: documents.version,
      fileName: documents.fileName,
      access: documents.access,
      ragStatus: documents.ragStatus,
    })
    .from(documents)
    .orderBy(desc(documents.updatedAt))
    .limit(500)
  return rows.map((row) => ({ ...row, ragStatus: row.ragStatus as RagStatus }))
}

/** Сменить статус актуальности. Возвращает false, если документа нет. */
export async function updateDocumentRagStatus(id: string, ragStatus: RagStatus): Promise<boolean> {
  if (isMockDb()) return false
  const { db } = await import("@/lib/db/client")
  const { documents } = await import("@/lib/db/schema")
  const updated = await db
    .update(documents)
    .set({ ragStatus, updatedAt: new Date() })
    .where(eq(documents.id, id))
    .returning({ id: documents.id })
  return updated.length > 0
}

export async function documentExists(id: string): Promise<boolean> {
  if (isMockDb()) return false
  const { db } = await import("@/lib/db/client")
  const { documents } = await import("@/lib/db/schema")
  const [row] = await db.select({ id: documents.id }).from(documents).where(eq(documents.id, id))
  return Boolean(row)
}

/** ФИО пользователей для журнала обращений. */
export async function loadUserNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (isMockDb() || ids.length === 0) return names
  const { db } = await import("@/lib/db/client")
  const { users } = await import("@/lib/db/schema")
  const rows = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(inArray(users.id, [...new Set(ids)]))
  for (const row of rows) names.set(row.id, formatFullName(row.lastName, row.firstName))
  return names
}
