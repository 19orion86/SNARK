import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { chatChannelMembers, chatMessages, chatPinnedMessages, users } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { formatFullName } from "@/lib/portal-data/format-name"

export interface PinnedMessageItem {
  id: string
  messageId: string
  channelId: string
  body: string
  authorName: string
  createdAt: string
  pinnedAt: string
}

async function assertMember(channelId: string, userId: string): Promise<void> {
  if (isMockDb()) {
    const { getMockChannelMemberIds } = await import("@/lib/repositories/chat.mock-store")
    if (!getMockChannelMemberIds(channelId).includes(userId)) {
      throw new Error("Нет доступа к каналу")
    }
    return
  }
  const [row] = await db
    .select({ id: chatChannelMembers.id })
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))
    .limit(1)
  if (!row) throw new Error("Нет доступа к каналу")
}

export async function listPinnedMessages(
  channelId: string,
  userId: string
): Promise<PinnedMessageItem[]> {
  await assertMember(channelId, userId)
  if (isMockDb()) return []

  const rows = await db
    .select({
      id: chatPinnedMessages.id,
      messageId: chatPinnedMessages.messageId,
      channelId: chatPinnedMessages.channelId,
      body: chatMessages.body,
      firstName: users.firstName,
      lastName: users.lastName,
      messageCreatedAt: chatMessages.createdAt,
      pinnedAt: chatPinnedMessages.createdAt,
    })
    .from(chatPinnedMessages)
    .innerJoin(chatMessages, eq(chatMessages.id, chatPinnedMessages.messageId))
    .leftJoin(users, eq(users.id, chatMessages.authorId))
    .where(eq(chatPinnedMessages.channelId, channelId))
    .orderBy(desc(chatPinnedMessages.createdAt))

  return rows.map((row) => ({
    id: row.id,
    messageId: row.messageId,
    channelId: row.channelId,
    body: row.body,
    authorName: formatFullName(row.lastName ?? "", row.firstName ?? "") || "Сотрудник",
    createdAt: row.messageCreatedAt.toISOString(),
    pinnedAt: row.pinnedAt.toISOString(),
  }))
}

export async function pinMessage(
  channelId: string,
  messageId: string,
  userId: string
): Promise<PinnedMessageItem> {
  await assertMember(channelId, userId)

  if (isMockDb()) {
    return {
      id: crypto.randomUUID(),
      messageId,
      channelId,
      body: "Закреплённое сообщение",
      authorName: "Сотрудник",
      createdAt: new Date().toISOString(),
      pinnedAt: new Date().toISOString(),
    }
  }

  const [message] = await db
    .select({ id: chatMessages.id, channelId: chatMessages.channelId })
    .from(chatMessages)
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.channelId, channelId)))
    .limit(1)
  if (!message) throw new Error("Сообщение не найдено")

  await db
    .insert(chatPinnedMessages)
    .values({
      channelId,
      messageId,
      pinnedBy: userId,
    })
    .onConflictDoNothing()

  const items = await listPinnedMessages(channelId, userId)
  const found = items.find((item) => item.messageId === messageId)
  if (!found) throw new Error("Не удалось закрепить сообщение")
  return found
}
