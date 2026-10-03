import "server-only"
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import {
  chatAttachments,
  chatChannelMembers,
  chatFolderChannels,
  chatFolders,
  chatMessages,
  chatReactions,
  users,
} from "@/lib/db/schema"
import { rowsOf } from "@/lib/db/rows"
import { isMockDb } from "@/lib/config/mode"
import { formatFullName } from "@/lib/portal-data/format-name"
import { getRealtimeBus } from "@/lib/realtime/bus"
import { listChannelMemberIds, sendMessage } from "@/lib/repositories/chat.repository"
import type { ChatMessage } from "@/types/portal"

export interface ChatReactionResult {
  messageId: string
  emoji: string
  added: boolean
}

export interface ChatFolderItem {
  id: string
  name: string
  sortOrder: number
  channelIds: string[]
  createdAt: string
}

export interface ChatSearchHit {
  messageId: string
  channelId: string
  body: string
  createdAt: string
  authorName: string
}

async function assertChannelMember(channelId: string, userId: string): Promise<void> {
  if (isMockDb()) {
    const { getMockChannelMemberIds } = await import("@/lib/repositories/chat.mock-store")
    const ids = getMockChannelMemberIds(channelId)
    if (!ids.includes(userId)) throw new Error("Нет доступа к каналу")
    return
  }
  const [membership] = await db
    .select({ id: chatChannelMembers.id })
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))
    .limit(1)
  if (!membership) throw new Error("Нет доступа к каналу")
}

export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<ChatReactionResult> {
  const trimmed = emoji.trim()
  if (!trimmed || trimmed.length > 32) {
    throw new Error("Некорректный emoji")
  }

  if (isMockDb()) {
    const { mockGetMessageById } = await import("@/lib/repositories/chat.mock-store")
    const message = mockGetMessageById(messageId)
    if (!message) throw new Error("Сообщение не найдено")
    await assertChannelMember(message.channelId, userId)
    return { messageId, emoji: trimmed, added: true }
  }

  const [message] = await db
    .select({ id: chatMessages.id, channelId: chatMessages.channelId })
    .from(chatMessages)
    .where(eq(chatMessages.id, messageId))
    .limit(1)
  if (!message) throw new Error("Сообщение не найдено")
  await assertChannelMember(message.channelId, userId)

  const [existing] = await db
    .select({ id: chatReactions.id })
    .from(chatReactions)
    .where(
      and(
        eq(chatReactions.messageId, messageId),
        eq(chatReactions.userId, userId),
        eq(chatReactions.emoji, trimmed)
      )
    )
    .limit(1)

  if (existing) {
    await db.delete(chatReactions).where(eq(chatReactions.id, existing.id))
    return { messageId, emoji: trimmed, added: false }
  }

  await db.insert(chatReactions).values({
    messageId,
    userId,
    emoji: trimmed,
  })
  return { messageId, emoji: trimmed, added: true }
}

export async function createAttachmentMessage(
  channelId: string,
  userId: string,
  file: {
    fileName: string
    fileUrl: string
    mimeType: string
    sizeBytes: number
  }
): Promise<{ message: ChatMessage; attachmentId: string }> {
  await assertChannelMember(channelId, userId)

  const message = await sendMessage(channelId, userId, file.fileName)

  if (isMockDb()) {
    return { message, attachmentId: crypto.randomUUID() }
  }

  const [attachment] = await db
    .insert(chatAttachments)
    .values({
      messageId: message.id,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedBy: userId,
    })
    .returning({ id: chatAttachments.id })

  if (!attachment) throw new Error("Не удалось сохранить вложение")
  return { message, attachmentId: attachment.id }
}

export async function listChatFolders(userId: string): Promise<ChatFolderItem[]> {
  if (isMockDb()) return []

  const folders = await db
    .select({
      id: chatFolders.id,
      name: chatFolders.name,
      sortOrder: chatFolders.sortOrder,
      createdAt: chatFolders.createdAt,
    })
    .from(chatFolders)
    .where(eq(chatFolders.userId, userId))
    .orderBy(chatFolders.sortOrder, chatFolders.createdAt)

  if (folders.length === 0) return []

  const folderIds = folders.map((folder) => folder.id)
  const links = await db
    .select({
      folderId: chatFolderChannels.folderId,
      channelId: chatFolderChannels.channelId,
    })
    .from(chatFolderChannels)
    .where(inArray(chatFolderChannels.folderId, folderIds))

  const channelsByFolder = new Map<string, string[]>()
  for (const link of links) {
    const list = channelsByFolder.get(link.folderId) ?? []
    list.push(link.channelId)
    channelsByFolder.set(link.folderId, list)
  }

  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    sortOrder: folder.sortOrder,
    channelIds: channelsByFolder.get(folder.id) ?? [],
    createdAt: folder.createdAt.toISOString(),
  }))
}

export async function createChatFolder(userId: string, name: string): Promise<ChatFolderItem> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Укажите название папки")

  if (isMockDb()) {
    return {
      id: crypto.randomUUID(),
      name: trimmed,
      sortOrder: 0,
      channelIds: [],
      createdAt: new Date().toISOString(),
    }
  }

  const maxRows = await db
    .select({ maxOrder: sql<number>`coalesce(max(${chatFolders.sortOrder}), 0)` })
    .from(chatFolders)
    .where(eq(chatFolders.userId, userId))
  const maxOrder = Number(maxRows[0]?.maxOrder ?? 0)

  const [folder] = await db
    .insert(chatFolders)
    .values({
      userId,
      name: trimmed,
      sortOrder: maxOrder + 1,
    })
    .returning()

  return {
    id: folder.id,
    name: folder.name,
    sortOrder: folder.sortOrder,
    channelIds: [],
    createdAt: folder.createdAt.toISOString(),
  }
}

export async function addChannelToFolder(
  folderId: string,
  userId: string,
  channelId: string
): Promise<ChatFolderItem> {
  if (isMockDb()) {
    return {
      id: folderId,
      name: "Папка",
      sortOrder: 0,
      channelIds: [channelId],
      createdAt: new Date().toISOString(),
    }
  }

  const [folder] = await db
    .select()
    .from(chatFolders)
    .where(and(eq(chatFolders.id, folderId), eq(chatFolders.userId, userId)))
    .limit(1)
  if (!folder) throw new Error("Папка не найдена")

  await assertChannelMember(channelId, userId)

  await db
    .insert(chatFolderChannels)
    .values({ folderId, channelId })
    .onConflictDoNothing()

  const items = await listChatFolders(userId)
  const found = items.find((item) => item.id === folderId)
  if (!found) throw new Error("Папка не найдена")
  return found
}

export async function searchChatMessages(userId: string, query: string): Promise<ChatSearchHit[]> {
  const q = query.trim()
  if (!q) return []

  if (isMockDb()) {
    const { mockListChannelsForUser, mockListMessages } = await import(
      "@/lib/repositories/chat.mock-store"
    )
    const channels = mockListChannelsForUser(userId)
    const hits: ChatSearchHit[] = []
    const lower = q.toLowerCase()
    for (const channel of channels) {
      for (const message of mockListMessages(channel.id, userId, 200)) {
        if (message.body.toLowerCase().includes(lower)) {
          hits.push({
            messageId: message.id,
            channelId: channel.id,
            body: message.body,
            createdAt: message.createdAt,
            authorName: message.authorName,
          })
        }
      }
    }
    return hits.slice(0, 30)
  }

  // Prefer FTS when search_vector is populated; fall back to ILIKE.
  const ftsRows = await db.execute(sql`
    SELECT m.id AS "messageId", m.channel_id AS "channelId", m.body, m.created_at AS "createdAt",
           u.first_name AS "firstName", u.last_name AS "lastName"
    FROM chat_messages m
    INNER JOIN users u ON u.id = m.author_id
    WHERE m.channel_id IN (
        SELECT cm.channel_id FROM chat_channel_members cm WHERE cm.user_id = ${userId}
      )
      AND (
        (m.search_vector IS NOT NULL AND m.search_vector @@ plainto_tsquery('simple', ${q}))
        OR m.body ILIKE ${"%" + q + "%"}
      )
    ORDER BY m.created_at DESC
    LIMIT 30
  `)

  const rows = rowsOf<Record<string, unknown>>(ftsRows)

  return rows.map((row) => ({
    messageId: String(row.messageId ?? row.messageid),
    channelId: String(row.channelId ?? row.channelid),
    body: String(row.body ?? ""),
    createdAt: new Date(String(row.createdAt ?? row.createdat)).toISOString(),
    authorName: formatFullName(
      String(row.lastName ?? row.lastname ?? ""),
      String(row.firstName ?? row.firstname ?? "")
    ),
  }))
}

export async function publishTypingStart(
  channelId: string,
  userId: string,
  userName?: string
): Promise<void> {
  await assertChannelMember(channelId, userId)
  const memberIds = await listChannelMemberIds(channelId)
  getRealtimeBus().publish({
    type: "typing.start",
    channelId,
    userId,
    userName,
    memberIds,
  })
}
