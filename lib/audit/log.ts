import { db } from "@/lib/db/client"
import { auditLogs } from "@/lib/db/schema"

interface AuditLogInput {
  userId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  metadata?: string
  statusCode?: number
}

export async function writeAuditLog(entry: AuditLogInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
      statusCode: entry.statusCode,
    })
  } catch {
    // Avoid cascading API failures due to audit insert issues.
  }
}
