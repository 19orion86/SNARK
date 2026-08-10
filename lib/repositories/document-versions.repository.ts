import "server-only"
import { asc, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { documentVersions, documents } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"

export interface DocumentVersion {
  id: string
  documentId: string
  versionLabel: string
  fileUrl: string | null
  changeNote: string | null
  uploadedBy: string | null
  createdAt: string
}

const mockVersions: DocumentVersion[] = []

function mapRow(row: typeof documentVersions.$inferSelect): DocumentVersion {
  return {
    id: row.id,
    documentId: row.documentId,
    versionLabel: row.versionLabel,
    fileUrl: row.fileUrl,
    changeNote: row.changeNote,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function assertDocumentExists(documentId: string): Promise<boolean> {
  if (isMockDb()) return true
  const [row] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)
  return Boolean(row)
}

export async function listDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  if (isMockDb()) {
    return mockVersions
      .filter((v) => v.documentId === documentId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  const rows = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.createdAt))

  return rows.map(mapRow)
}

export async function addDocumentVersion(input: {
  documentId: string
  versionLabel: string
  changeNote?: string | null
  fileUrl?: string | null
  uploadedBy: string
}): Promise<DocumentVersion> {
  const exists = await assertDocumentExists(input.documentId)
  if (!exists) throw new Error("Документ не найден")

  const versionLabel = input.versionLabel.trim()
  if (!versionLabel) throw new Error("Укажите метку версии")

  if (isMockDb()) {
    const item: DocumentVersion = {
      id: crypto.randomUUID(),
      documentId: input.documentId,
      versionLabel,
      fileUrl: input.fileUrl?.trim() || null,
      changeNote: input.changeNote?.trim() || null,
      uploadedBy: input.uploadedBy,
      createdAt: new Date().toISOString(),
    }
    mockVersions.unshift(item)
    return item
  }

  const [created] = await db
    .insert(documentVersions)
    .values({
      documentId: input.documentId,
      versionLabel,
      fileUrl: input.fileUrl?.trim() || null,
      changeNote: input.changeNote?.trim() || null,
      uploadedBy: input.uploadedBy,
    })
    .returning()

  await db
    .update(documents)
    .set({ version: versionLabel, updatedAt: new Date() })
    .where(eq(documents.id, input.documentId))

  return mapRow(created)
}

export async function listOldestFirst(documentId: string): Promise<DocumentVersion[]> {
  if (isMockDb()) {
    return mockVersions
      .filter((v) => v.documentId === documentId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  }
  const rows = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(asc(documentVersions.createdAt))
  return rows.map(mapRow)
}
