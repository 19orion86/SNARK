import "server-only"
import { eq } from "drizzle-orm"
import type { RequestAuthContext } from "@/lib/auth/request-auth"
import { isMockDb } from "@/lib/config/mode"
import type { DocumentRequester } from "@/lib/documents/access"

/** Роль берётся из токена, отдел — из БД (в токене его нет). */
export async function loadDocumentRequester(auth: RequestAuthContext): Promise<DocumentRequester> {
  if (isMockDb()) return { role: auth.role, departmentId: null }
  const { db } = await import("@/lib/db/client")
  const { users } = await import("@/lib/db/schema")
  const [row] = await db
    .select({ departmentId: users.departmentId })
    .from(users)
    .where(eq(users.id, auth.userId))
  return { role: auth.role, departmentId: row?.departmentId ?? null }
}
