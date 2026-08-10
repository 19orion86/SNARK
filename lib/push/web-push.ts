import "server-only"
import webpush from "web-push"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { pushSubscriptions } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"

function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return null
  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT?.trim() || "mailto:admin@localhost",
  }
}

export function getVapidPublicKey(): string | null {
  return getVapidConfig()?.publicKey ?? null
}

let vapidConfigured = false

function ensureVapid(): ReturnType<typeof getVapidConfig> {
  const config = getVapidConfig()
  if (!config) return null
  if (!vapidConfigured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
    vapidConfigured = true
  }
  return config
}

export async function upsertPushSubscription(input: {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string | null
}): Promise<void> {
  if (isMockDb()) return

  const [existing] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, input.endpoint))
    .limit(1)

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      })
      .where(eq(pushSubscriptions.id, existing.id))
    return
  }

  await db.insert(pushSubscriptions).values({
    userId: input.userId,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent ?? null,
  })
}

export async function deletePushSubscription(endpoint: string, userId?: string): Promise<number> {
  if (isMockDb()) return 0
  const deleted = await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .returning({ id: pushSubscriptions.id, userId: pushSubscriptions.userId })

  if (userId) {
    return deleted.filter((row) => row.userId === userId).length
  }
  return deleted.length
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body?: string; url?: string; data?: Record<string, unknown> }
): Promise<void> {
  if (isMockDb()) return
  if (!ensureVapid()) return

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))

  if (subs.length === 0) return

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? payload.title,
    url: payload.url,
    data: payload.data ?? {},
  })

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        )
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
        }
      }
    })
  )
}
