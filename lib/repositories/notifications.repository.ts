import "server-only"
import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { notificationPreferences, notifications, users } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { sendEmail } from "@/lib/email/send"
import { getRealtimeBus } from "@/lib/realtime/bus"

export type NotificationType =
  | "task_assigned"
  | "mention"
  | "task_comment"
  | "protocol_task"
  | "task_due_soon"
  | "task_overdue"

export interface PortalNotification {
  id: string
  userId: string
  type: NotificationType | string
  title: string
  entityType: string | null
  entityId: string | null
  readAt: string | null
  createdAt: string
}

const mockNotifications: PortalNotification[] = []

function mapRow(row: {
  id: string
  userId: string
  type: string
  title: string
  entityType: string | null
  entityId: string | null
  readAt: Date | null
  createdAt: Date
}): PortalNotification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    entityType: row.entityType,
    entityId: row.entityId,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

function publishNotification(item: PortalNotification): void {
  getRealtimeBus().publish({
    type: "notification.new",
    userId: item.userId,
    notification: {
      id: item.id,
      type: item.type,
      title: item.title,
      entityType: item.entityType,
      entityId: item.entityId,
      createdAt: item.createdAt,
    },
  })
}

export async function createNotification(input: {
  userId: string
  type: NotificationType
  title: string
  entityType?: string | null
  entityId?: string | null
}): Promise<PortalNotification> {
  if (isMockDb()) {
    const item: PortalNotification = {
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      readAt: null,
      createdAt: new Date().toISOString(),
    }
    mockNotifications.unshift(item)
    publishNotification(item)
    void import("@/lib/push/web-push")
      .then(({ sendPushToUser }) =>
        sendPushToUser(item.userId, {
          title: item.title,
          body: item.title,
          data: {
            type: item.type,
            entityType: item.entityType,
            entityId: item.entityId,
          },
        })
      )
      .catch(() => {})
    return item
  }

  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })
    .returning()

  const item = mapRow(row)
  publishNotification(item)
  void dispatchEmailNotification(item).catch(() => {})
  void import("@/lib/push/web-push")
    .then(({ sendPushToUser }) =>
      sendPushToUser(item.userId, {
        title: item.title,
        body: item.title,
        data: {
          type: item.type,
          entityType: item.entityType,
          entityId: item.entityId,
        },
        url:
          item.entityType === "task" && item.entityId
            ? `/tasks/${item.entityId}`
            : item.entityType === "chat_channel" && item.entityId
              ? `/chat?channel=${item.entityId}`
              : undefined,
      })
    )
    .catch(() => {})
  return item
}

async function dispatchEmailNotification(item: PortalNotification): Promise<void> {
  if (isMockDb()) return
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, item.userId))
    .limit(1)
  if (prefs && prefs.emailEnabled === false) return

  const [user] = await db
    .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, item.userId))
    .limit(1)
  if (!user?.email) return

  const link =
    item.entityType === "task" && item.entityId
      ? `${process.env.APP_URL ?? ""}/tasks/${item.entityId}`
      : process.env.APP_URL ?? ""

  await sendEmail({
    to: user.email,
    subject: `[SNARK] ${item.title}`,
    text: `${item.title}\n\n${link}`.trim(),
  })
}

export async function listNotifications(
  userId: string,
  limit = 20
): Promise<{ items: PortalNotification[]; unreadCount: number }> {
  if (isMockDb()) {
    const items = mockNotifications.filter((n) => n.userId === userId).slice(0, limit)
    const unreadCount = mockNotifications.filter((n) => n.userId === userId && !n.readAt).length
    return { items, unreadCount }
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)

  const [unreadRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return {
    items: rows.map(mapRow),
    unreadCount: Number(unreadRow?.value ?? 0),
  }
}

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<PortalNotification | null> {
  if (isMockDb()) {
    const item = mockNotifications.find((n) => n.id === notificationId && n.userId === userId)
    if (!item) return null
    item.readAt = new Date().toISOString()
    return item
  }

  const [row] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning()

  return row ? mapRow(row) : null
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  if (isMockDb()) {
    let count = 0
    for (const item of mockNotifications) {
      if (item.userId === userId && !item.readAt) {
        item.readAt = new Date().toISOString()
        count++
      }
    }
    return count
  }

  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id })

  return updated.length
}
