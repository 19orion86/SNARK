import "server-only"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "@/lib/db/client"
import { chatChannelMembers, chatChannels, chatMessages, departments, employeeProfiles, users } from "@/lib/db/schema"
import { formatFullName } from "@/lib/portal-data/format-name"
import type {
  ChatChannel,
  ChatChannelCreatePayload,
  ChatChannelMember,
  ChatChannelsListResponse,
  ChatMessage,
  ChatMessageType,
  ChatMessagesListResponse,
} from "@/types/portal"
import type { UserRole } from "@/types/auth"
import {
  mockAddChannelMembers,
  mockCreateChannel,
  mockEditMessage,
  mockDeleteMessage,
  mockFindOrCreateDirectChannel,
  mockGetMessageById,
  mockListChannelMembers,
  mockListChannelsForUser,
  mockListMessages,
  mockMarkChannelRead,
  mockRemoveChannelMembers,
  mockSendMessage,
} from "@/lib/repositories/chat.mock-store"
import { isMockDb } from "@/lib/config/mode"
import { getRealtimeBus } from "@/lib/realtime/bus"
import { assertMessageRateLimit } from "@/lib/realtime/rate-limit"
import { createNotification } from "@/lib/repositories/notifications.repository"

const author = alias(users, "message_author")
const replyMessage = alias(chatMessages, "reply_message")

const EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000

export function makeDirectKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(":")
}

function mapMessage(row: {
  id: string
  channelId: string
  authorId: string
  authorFirstName: string
  authorLastName: string
  body: string
  messageType?: string | null
  replyToId?: string | null
  replyToBody?: string | null
  linkedTaskId?: string | null
  createdAt: Date
  editedAt: Date | null
}): ChatMessage {
  return {
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    authorName: formatFullName(row.authorLastName, row.authorFirstName),
    body: row.body,
    messageType: (row.messageType ?? "user") as ChatMessageType,
    replyToId: row.replyToId ?? null,
    replyToBody: row.replyToBody ?? null,
    linkedTaskId: row.linkedTaskId ?? null,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
  }
}

function parseLinkedTaskId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const taskId = (metadata as { taskId?: unknown }).taskId
  return typeof taskId === "string" ? taskId : null
}

function canBypassEditWindow(role?: UserRole): boolean {
  return role === "admin" || role === "hr_manager"
}

async function listChannelMemberIds(channelId: string): Promise<string[]> {
  if (isMockDb()) {
    const { getMockChannelMemberIds } = await import("@/lib/repositories/chat.mock-store")
    return getMockChannelMemberIds(channelId)
  }

  const rows = await db
    .select({ userId: chatChannelMembers.userId })
    .from(chatChannelMembers)
    .where(eq(chatChannelMembers.channelId, channelId))
  return rows.map((row) => row.userId)
}

function assertEditDeleteAllowed(
  messageCreatedAt: Date,
  role?: UserRole
): void {
  if (canBypassEditWindow(role)) return
  if (Date.now() - messageCreatedAt.getTime() > EDIT_DELETE_WINDOW_MS) {
    throw new Error("Редактирование/удаление доступно только в течение 15 минут")
  }
}

/** Список каналов: ≤4 SQL-запроса (без N+1). */
export async function listMyChannels(userId: string): Promise<ChatChannelsListResponse> {
  if (isMockDb()) {
    return { items: mockListChannelsForUser(userId) }
  }

  // 1) Каналы + lastReadAt
  const channelRows = await db
    .select({
      id: chatChannels.id,
      name: chatChannels.name,
      type: chatChannels.type,
      taskId: chatChannels.taskId,
      departmentId: chatChannels.departmentId,
      createdBy: chatChannels.createdBy,
      createdAt: chatChannels.createdAt,
      updatedAt: chatChannels.updatedAt,
      lastReadAt: chatChannelMembers.lastReadAt,
    })
    .from(chatChannelMembers)
    .innerJoin(chatChannels, eq(chatChannels.id, chatChannelMembers.channelId))
    .where(eq(chatChannelMembers.userId, userId))
    .orderBy(desc(chatChannels.updatedAt))

  if (channelRows.length === 0) {
    return { items: [] }
  }

  const channelIds = channelRows.map((row) => row.id)

  // 2) Последние сообщения (DISTINCT ON)
  const lastMsgResult = await db.execute(sql`
    SELECT DISTINCT ON (m.channel_id)
      m.id,
      m.channel_id,
      m.author_id,
      u.first_name,
      u.last_name,
      m.body,
      m.message_type,
      m.reply_to_id,
      m.metadata,
      m.created_at,
      m.edited_at
    FROM chat_messages m
    INNER JOIN users u ON u.id = m.author_id
    WHERE m.channel_id IN (${sql.join(
      channelIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )})
    ORDER BY m.channel_id, m.created_at DESC
  `)

  const lastMsgList = (
    Array.isArray(lastMsgResult) ? lastMsgResult : []
  ) as Array<{
    id: string
    channel_id: string
    author_id: string
    first_name: string
    last_name: string
    body: string
    message_type: string
    reply_to_id: string | null
    metadata: unknown
    created_at: Date | string
    edited_at: Date | string | null
  }>

  const lastMap = new Map<string, (typeof lastMsgList)[number]>()
  for (const row of lastMsgList) {
    lastMap.set(row.channel_id, row)
  }

  // 3) Участники (счётчик + peer для direct)
  const memberRows = await db
    .select({
      channelId: chatChannelMembers.channelId,
      userId: chatChannelMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      middleName: employeeProfiles.middleName,
    })
    .from(chatChannelMembers)
    .innerJoin(users, eq(users.id, chatChannelMembers.userId))
    .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
    .where(inArray(chatChannelMembers.channelId, channelIds))

  const membersByChannel = new Map<string, typeof memberRows>()
  for (const row of memberRows) {
    const list = membersByChannel.get(row.channelId) ?? []
    list.push(row)
    membersByChannel.set(row.channelId, list)
  }

  // 4) Unread: lastReadAt IS NULL → все чужие сообщения
  const unreadResult = await db.execute(sql`
    SELECT msg.channel_id, count(*)::int AS unread
    FROM chat_messages msg
    INNER JOIN chat_channel_members m
      ON m.channel_id = msg.channel_id AND m.user_id = ${userId}::uuid
    WHERE msg.channel_id IN (${sql.join(
      channelIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )})
      AND msg.author_id <> ${userId}::uuid
      AND msg.message_type = 'user'
      AND (m.last_read_at IS NULL OR msg.created_at > m.last_read_at)
    GROUP BY msg.channel_id
  `)

  const unreadList = (
    Array.isArray(unreadResult) ? unreadResult : []
  ) as Array<{ channel_id: string; unread: number }>
  const unreadMap = new Map<string, number>()
  for (const row of unreadList) {
    unreadMap.set(row.channel_id, Number(row.unread))
  }

  const items: ChatChannel[] = channelRows.map((channel) => {
    const members = membersByChannel.get(channel.id) ?? []
    let peerId: string | null = null
    let peerName: string | null = null
    if (channel.type === "direct") {
      const peer = members.find((member) => member.userId !== userId)
      if (peer) {
        peerId = peer.userId
        peerName = formatFullName(peer.lastName, peer.firstName, peer.middleName)
      }
    }

    const last = lastMap.get(channel.id)
    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      taskId: channel.taskId,
      departmentId: channel.departmentId,
      createdBy: channel.createdBy,
      memberCount: members.length,
      unreadCount: unreadMap.get(channel.id) ?? 0,
      lastMessage: last
        ? mapMessage({
            id: last.id,
            channelId: last.channel_id,
            authorId: last.author_id,
            authorFirstName: last.first_name,
            authorLastName: last.last_name,
            body: last.body,
            messageType: last.message_type,
            replyToId: last.reply_to_id,
            linkedTaskId: parseLinkedTaskId(last.metadata),
            createdAt: new Date(last.created_at),
            editedAt: last.edited_at ? new Date(last.edited_at) : null,
          })
        : null,
      peerId,
      peerName,
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
    }
  })

  return { items }
}

export async function listChannelMessages(
  channelId: string,
  userId: string,
  limit = 50
): Promise<ChatMessagesListResponse> {
  if (isMockDb()) {
    mockMarkChannelRead(channelId, userId)
    return {
      channelId,
      items: mockListMessages(channelId, userId, limit),
    }
  }

  const [membership] = await db
    .select({ id: chatChannelMembers.id })
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))
    .limit(1)

  if (!membership) {
    throw new Error("Нет доступа к каналу")
  }

  const rows = await db
    .select({
      id: chatMessages.id,
      channelId: chatMessages.channelId,
      authorId: chatMessages.authorId,
      authorFirstName: author.firstName,
      authorLastName: author.lastName,
      body: chatMessages.body,
      messageType: chatMessages.messageType,
      replyToId: chatMessages.replyToId,
      replyToBody: replyMessage.body,
      metadata: chatMessages.metadata,
      createdAt: chatMessages.createdAt,
      editedAt: chatMessages.editedAt,
    })
    .from(chatMessages)
    .innerJoin(author, eq(author.id, chatMessages.authorId))
    .leftJoin(replyMessage, eq(replyMessage.id, chatMessages.replyToId))
    .where(eq(chatMessages.channelId, channelId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit)

  await db
    .update(chatChannelMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))

  return {
    channelId,
    items: rows.reverse().map((row) =>
      mapMessage({
        id: row.id,
        channelId: row.channelId,
        authorId: row.authorId,
        authorFirstName: row.authorFirstName,
        authorLastName: row.authorLastName,
        body: row.body,
        messageType: row.messageType,
        replyToId: row.replyToId,
        replyToBody: row.replyToBody,
        linkedTaskId: parseLinkedTaskId(row.metadata),
        createdAt: row.createdAt,
        editedAt: row.editedAt,
      })
    ),
  }
}

export async function createChannel(
  payload: ChatChannelCreatePayload & { createdBy: string; directKey?: string | null }
): Promise<ChatChannel> {
  const uniqueMembers = Array.from(new Set([payload.createdBy, ...payload.memberIds]))

  if (isMockDb()) {
    return mockCreateChannel({
      name: payload.name ?? null,
      type: payload.type,
      departmentId: payload.departmentId ?? null,
      createdBy: payload.createdBy,
      memberIds: uniqueMembers.filter((id) => id !== payload.createdBy),
    })
  }

  const directKey =
    payload.type === "direct"
      ? payload.directKey ??
        (uniqueMembers.length === 2 ? makeDirectKey(uniqueMembers[0], uniqueMembers[1]) : null)
      : null

  const [channel] = await db
    .insert(chatChannels)
    .values({
      name: payload.name ?? null,
      type: payload.type,
      departmentId: payload.departmentId ?? null,
      createdBy: payload.createdBy,
      directKey,
    })
    .returning()

  // Создатель: уже прочитал. Остальные: lastReadAt null → полный unread при наличии истории.
  await db.insert(chatChannelMembers).values(
    uniqueMembers.map((memberId) => ({
      channelId: channel.id,
      userId: memberId,
      lastReadAt: memberId === payload.createdBy ? new Date() : null,
    }))
  )

  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    taskId: channel.taskId,
    departmentId: channel.departmentId,
    createdBy: channel.createdBy,
    memberCount: uniqueMembers.length,
    unreadCount: 0,
    lastMessage: null,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  }
}

export async function sendMessage(
  channelId: string,
  userId: string,
  body: string,
  options?: {
    replyToId?: string | null
    messageType?: ChatMessageType
    mentionIds?: string[]
  }
): Promise<ChatMessage> {
  assertMessageRateLimit(userId)

  if (isMockDb()) {
    const message = mockSendMessage(channelId, userId, body, options)
    const memberIds = await listChannelMemberIds(channelId)
    getRealtimeBus().publish({
      type: "message.new",
      channelId,
      message,
      memberIds,
    })
    await notifyMentions(channelId, userId, body, options?.mentionIds ?? [], memberIds)
    return message
  }

  const [membership] = await db
    .select({ id: chatChannelMembers.id })
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))
    .limit(1)

  if (!membership) {
    throw new Error("Нет доступа к каналу")
  }

  const [inserted] = await db
    .insert(chatMessages)
    .values({
      channelId,
      authorId: userId,
      body,
      messageType: options?.messageType ?? "user",
      replyToId: options?.replyToId ?? null,
    })
    .returning({ id: chatMessages.id })

  await db.update(chatChannels).set({ updatedAt: new Date() }).where(eq(chatChannels.id, channelId))

  await db
    .update(chatChannelMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))

  const [row] = await db
    .select({
      id: chatMessages.id,
      channelId: chatMessages.channelId,
      authorId: chatMessages.authorId,
      authorFirstName: author.firstName,
      authorLastName: author.lastName,
      body: chatMessages.body,
      messageType: chatMessages.messageType,
      replyToId: chatMessages.replyToId,
      metadata: chatMessages.metadata,
      createdAt: chatMessages.createdAt,
      editedAt: chatMessages.editedAt,
    })
    .from(chatMessages)
    .innerJoin(author, eq(author.id, chatMessages.authorId))
    .where(eq(chatMessages.id, inserted.id))
    .limit(1)

  if (!row) throw new Error("Не удалось отправить сообщение")
  const message = mapMessage({
    ...row,
    linkedTaskId: parseLinkedTaskId(row.metadata),
  })
  const memberIds = await listChannelMemberIds(channelId)
  getRealtimeBus().publish({
    type: "message.new",
    channelId,
    message,
    memberIds,
  })
  await notifyMentions(channelId, userId, body, options?.mentionIds ?? [], memberIds)
  return message
}

async function notifyMentions(
  channelId: string,
  authorId: string,
  body: string,
  explicitIds: string[],
  memberIds: string[]
): Promise<void> {
  const ids = Array.from(new Set(explicitIds)).filter(
    (id) => id !== authorId && memberIds.includes(id)
  )
  for (const mentionedId of ids) {
    await createNotification({
      userId: mentionedId,
      type: "mention",
      title: `Вас упомянули в чате: «${body.slice(0, 80)}»`,
      entityType: "chat_channel",
      entityId: channelId,
    })
  }
}

export async function getMessageById(messageId: string): Promise<ChatMessage | null> {
  if (isMockDb()) {
    return mockGetMessageById(messageId)
  }

  const [row] = await db
    .select({
      id: chatMessages.id,
      channelId: chatMessages.channelId,
      authorId: chatMessages.authorId,
      authorFirstName: author.firstName,
      authorLastName: author.lastName,
      body: chatMessages.body,
      messageType: chatMessages.messageType,
      replyToId: chatMessages.replyToId,
      metadata: chatMessages.metadata,
      createdAt: chatMessages.createdAt,
      editedAt: chatMessages.editedAt,
    })
    .from(chatMessages)
    .innerJoin(author, eq(author.id, chatMessages.authorId))
    .where(eq(chatMessages.id, messageId))
    .limit(1)

  if (!row) return null
  return mapMessage({
    ...row,
    linkedTaskId: parseLinkedTaskId(row.metadata),
  })
}

export async function updateMessage(
  channelId: string,
  messageId: string,
  userId: string,
  body: string,
  role?: UserRole
): Promise<ChatMessage> {
  if (isMockDb()) {
    const updated = mockEditMessage(channelId, messageId, userId, body, role)
    if (!updated) throw new Error("Сообщение не найдено")
    const memberIds = await listChannelMemberIds(channelId)
    getRealtimeBus().publish({
      type: "message.updated",
      channelId,
      message: updated,
      memberIds,
    })
    return updated
  }

  const [row] = await db
    .select({
      id: chatMessages.id,
      channelId: chatMessages.channelId,
      authorId: chatMessages.authorId,
      createdAt: chatMessages.createdAt,
      messageType: chatMessages.messageType,
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.channelId, channelId)))
    .limit(1)

  if (!row) throw new Error("Сообщение не найдено")
  if (row.authorId !== userId) {
    throw new Error("Можно редактировать только свои сообщения")
  }
  if (row.messageType !== "user") throw new Error("Системные сообщения нельзя редактировать")
  assertEditDeleteAllowed(row.createdAt, role)

  const [membership] = await db
    .select({ id: chatChannelMembers.id })
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))
    .limit(1)
  if (!membership) throw new Error("Нет доступа к каналу")

  await db
    .update(chatMessages)
    .set({ body, editedAt: new Date() })
    .where(eq(chatMessages.id, messageId))

  await db.update(chatChannels).set({ updatedAt: new Date() }).where(eq(chatChannels.id, channelId))

  const message = await getMessageById(messageId)
  if (!message) throw new Error("Сообщение не найдено")
  const memberIds = await listChannelMemberIds(channelId)
  getRealtimeBus().publish({
    type: "message.updated",
    channelId,
    message,
    memberIds,
  })
  return message
}

export async function deleteMessage(
  channelId: string,
  messageId: string,
  userId: string,
  role?: UserRole
): Promise<void> {
  if (isMockDb()) {
    const ok = mockDeleteMessage(channelId, messageId, userId, role)
    if (!ok) throw new Error("Сообщение не найдено")
    const memberIds = await listChannelMemberIds(channelId)
    getRealtimeBus().publish({
      type: "message.deleted",
      channelId,
      messageId,
      memberIds,
    })
    return
  }

  const [row] = await db
    .select({
      id: chatMessages.id,
      authorId: chatMessages.authorId,
      createdAt: chatMessages.createdAt,
      messageType: chatMessages.messageType,
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.channelId, channelId)))
    .limit(1)

  if (!row) throw new Error("Сообщение не найдено")
  if (row.authorId !== userId) {
    throw new Error("Можно удалять только свои сообщения")
  }
  if (row.messageType !== "user") {
    throw new Error("Системные сообщения нельзя удалять")
  }
  assertEditDeleteAllowed(row.createdAt, role)

  const [membership] = await db
    .select({ id: chatChannelMembers.id })
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))
    .limit(1)
  if (!membership) throw new Error("Нет доступа к каналу")

  await db.delete(chatMessages).where(eq(chatMessages.id, messageId))
  await db.update(chatChannels).set({ updatedAt: new Date() }).where(eq(chatChannels.id, channelId))
  const memberIds = await listChannelMemberIds(channelId)
  getRealtimeBus().publish({
    type: "message.deleted",
    channelId,
    messageId,
    memberIds,
  })
}

export async function findOrCreateDirectChannel(
  userId: string,
  peerId: string
): Promise<ChatChannel> {
  if (userId === peerId) throw new Error("Нельзя создать чат с собой")
  const key = makeDirectKey(userId, peerId)

  if (isMockDb()) {
    return mockFindOrCreateDirectChannel(userId, peerId)
  }

  const [existing] = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.directKey, key))
    .limit(1)

  if (existing) {
    // Гарантируем членство (на случай битых данных)
    await db
      .insert(chatChannelMembers)
      .values([
        { channelId: existing.id, userId, lastReadAt: new Date() },
        { channelId: existing.id, userId: peerId, lastReadAt: null },
      ])
      .onConflictDoNothing()

    const listed = await listMyChannels(userId)
    const found = listed.items.find((item) => item.id === existing.id)
    if (found) return found
  }

  try {
    const created = await createChannel({
      type: "direct",
      memberIds: [peerId],
      createdBy: userId,
      directKey: key,
    })
    const listed = await listMyChannels(userId)
    return listed.items.find((item) => item.id === created.id) ?? created
  } catch {
    // Гонка: параллельный insert — читаем победивший канал
    const [again] = await db
      .select()
      .from(chatChannels)
      .where(eq(chatChannels.directKey, key))
      .limit(1)
    if (!again) throw new Error("Не удалось создать личный чат")
    const listed = await listMyChannels(userId)
    const found = listed.items.find((item) => item.id === again.id)
    if (found) return found
    throw new Error("Не удалось открыть личный чат")
  }
}

export async function addChannelMembers(
  channelId: string,
  actorUserId: string,
  memberIds: string[]
): Promise<ChatChannel> {
  const unique = Array.from(new Set(memberIds)).filter((id) => id !== actorUserId)
  if (unique.length === 0) {
    throw new Error("Укажите участников")
  }

  if (isMockDb()) {
    const channel = mockAddChannelMembers(channelId, actorUserId, unique)
    if (!channel) throw new Error("Нет доступа к каналу")
    const currentMemberIds = await listChannelMemberIds(channelId)
    getRealtimeBus().publish({ type: "channel.updated", channelId, memberIds: currentMemberIds })
    return channel
  }

  const [membership] = await db
    .select({ id: chatChannelMembers.id })
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, actorUserId)))
    .limit(1)

  if (!membership) throw new Error("Нет доступа к каналу")

  const [channelRow] = await db.select().from(chatChannels).where(eq(chatChannels.id, channelId)).limit(1)
  if (!channelRow) throw new Error("Канал не найден")
  if (channelRow.type === "direct") throw new Error("Нельзя добавить участников в личный чат")

  const existing = await db
    .select({ userId: chatChannelMembers.userId })
    .from(chatChannelMembers)
    .where(eq(chatChannelMembers.channelId, channelId))
  const existingIds = new Set(existing.map((row) => row.userId))
  const toAdd = unique.filter((id) => !existingIds.has(id))

  if (toAdd.length > 0) {
    // Новый участник: lastReadAt = null → видит всю историю как непрочитанную
    await db.insert(chatChannelMembers).values(
      toAdd.map((uid) => ({
        channelId,
        userId: uid,
        lastReadAt: null,
      }))
    )
  }

  await db.update(chatChannels).set({ updatedAt: new Date() }).where(eq(chatChannels.id, channelId))

  const listed = await listMyChannels(actorUserId)
  const found = listed.items.find((item) => item.id === channelId)
  if (!found) throw new Error("Канал не найден")
  const currentMemberIds = await listChannelMemberIds(channelId)
  getRealtimeBus().publish({ type: "channel.updated", channelId, memberIds: currentMemberIds })
  return found
}

export async function removeChannelMembers(
  channelId: string,
  actorUserId: string,
  memberIds: string[]
): Promise<ChatChannel> {
  const unique = Array.from(new Set(memberIds))
  if (unique.length === 0) throw new Error("Укажите участников")

  if (isMockDb()) {
    const channel = mockRemoveChannelMembers(channelId, actorUserId, unique)
    if (!channel) throw new Error("Нет доступа к каналу")
    const ids = await listChannelMemberIds(channelId)
    getRealtimeBus().publish({ type: "channel.updated", channelId, memberIds: ids })
    return channel
  }

  const [membership] = await db
    .select({ id: chatChannelMembers.id })
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, actorUserId)))
    .limit(1)
  if (!membership) throw new Error("Нет доступа к каналу")

  const [channelRow] = await db.select().from(chatChannels).where(eq(chatChannels.id, channelId)).limit(1)
  if (!channelRow) throw new Error("Канал не найден")
  if (channelRow.type === "direct") throw new Error("Нельзя удалить участников из личного чата")

  // Нельзя удалить создателя канала
  const removable = unique.filter((id) => id !== channelRow.createdBy)
  if (removable.length > 0) {
    await db
      .delete(chatChannelMembers)
      .where(
        and(eq(chatChannelMembers.channelId, channelId), inArray(chatChannelMembers.userId, removable))
      )
  }

  await db.update(chatChannels).set({ updatedAt: new Date() }).where(eq(chatChannels.id, channelId))

  const listed = await listMyChannels(actorUserId)
  const found = listed.items.find((item) => item.id === channelId)
  if (!found) throw new Error("Канал не найден")
  const ids = await listChannelMemberIds(channelId)
  getRealtimeBus().publish({ type: "channel.updated", channelId, memberIds: ids })
  return found
}

export async function listChannelMembers(
  channelId: string,
  viewerUserId: string
): Promise<ChatChannelMember[]> {
  if (isMockDb()) {
    const items = mockListChannelMembers(channelId, viewerUserId)
    if (!items) throw new Error("Нет доступа к каналу")
    return items
  }

  const [membership] = await db
    .select({ id: chatChannelMembers.id })
    .from(chatChannelMembers)
    .where(
      and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, viewerUserId))
    )
    .limit(1)

  if (!membership) throw new Error("Нет доступа к каналу")

  const rows = await db
    .select({
      userId: chatChannelMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      middleName: employeeProfiles.middleName,
      positionTitle: employeeProfiles.positionTitle,
      departmentName: departments.name,
      joinedAt: chatChannelMembers.joinedAt,
    })
    .from(chatChannelMembers)
    .innerJoin(users, eq(users.id, chatChannelMembers.userId))
    .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(eq(chatChannelMembers.channelId, channelId))

  return rows
    .map((row) => ({
      userId: row.userId,
      name: formatFullName(row.lastName, row.firstName, row.middleName),
      position: row.positionTitle ?? null,
      department: row.departmentName ?? null,
      joinedAt: row.joinedAt ? new Date(row.joinedAt).toISOString() : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
}
