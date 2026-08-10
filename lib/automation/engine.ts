import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { automationRules } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { createNotification } from "@/lib/repositories/notifications.repository"
import { createTask } from "@/lib/repositories/tasks.repository"

export type AutomationTrigger =
  | "task.created"
  | "task.status_changed"
  | "protocol.completed"
  | "ticket.created"

interface RunContext {
  trigger: AutomationTrigger
  actorId?: string | null
  payload: Record<string, unknown>
}

/**
 * Простой движок правил: загружает active automation_rules с совпадающим trigger
 * и выполняет action (create_task | send_notification).
 */
export async function runAutomationRules(ctx: RunContext): Promise<number> {
  if (isMockDb()) return 0

  const rules = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.isActive, true))

  const matched = rules.filter((r) => r.trigger === ctx.trigger)
  let executed = 0

  for (const rule of matched) {
    const config = (rule.config ?? {}) as Record<string, unknown>
    try {
      if (rule.action === "send_notification") {
        const userId = String(config.userId ?? ctx.actorId ?? "")
        const title = String(config.title ?? rule.name)
        if (userId) {
          await createNotification({
            userId,
            type: "task_assigned",
            title,
            entityType: String(config.entityType ?? "task"),
            entityId: config.entityId ? String(config.entityId) : null,
          })
          executed++
        }
      } else if (rule.action === "create_task") {
        const title = String(config.title ?? `Автозадача: ${rule.name}`)
        const creatorId = String(config.creatorId ?? ctx.actorId ?? "")
        if (creatorId) {
          await createTask({
            title,
            description: String(config.description ?? JSON.stringify(ctx.payload).slice(0, 2000)),
            assigneeId: config.assigneeId ? String(config.assigneeId) : null,
            priority: (config.priority as "low" | "medium" | "high" | "critical") ?? "medium",
            creatorId,
          })
          executed++
        }
      }
    } catch {
      // не валим основную операцию из-за правила
    }
  }

  return executed
}
