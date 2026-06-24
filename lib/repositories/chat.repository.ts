import "server-only"
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "@/lib/db/client"
import { chatChannelMembers, chatChannels, chatMessages, employeeProfiles, users } from "@/lib/db/schema"
import { formatFullName } from "@/lib/portal-data/format-name"
import type {
  ChatChannel,
  ChatChannelCreatePayload,
  ChatChannelsListResponse,
  ChatMessage,
  ChatMessagesListResponse,
} from "@/types/portal"

const author = alias(users, "message_author")

const mockChannels: ChatChannel[] = []
const mockMessages: ChatMessage[] = []

function useMockDb(): boolean {
  return process.env.USE_MOCK_DB !== "false"
}

function mapMessage(row: {
  id: string
  channelId: string
  authorId: string
  authorFirstName: string
  authorLastName: string
  body: string
  createdAt: Date
  editedAt: Date | null
}): ChatMessage {
  return {
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    authorName: formatFullName(row.authorLastName, row.authorFirstName),
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
  }
}

export async function listMyChannels(userId: string): Promise<ChatChannelsListResponse> {
  if (useMockDb()) {
    return {
      items: mockChannels.filter((channel) =>
        mockMessages.some((msg) => msg.channelId === channel.id)
      ),
    }
  }

  const memberships = await db
    .select({ channelId: chatChannelMembers.channelId, lastReadAt: chatChannelMembers.lastReadAt })
    .from(chatChannelMembers)
    .where(eq(chatChannelMembers.userId, userId))

  if (memberships.length === 0) {
    return { items: [] }
  }

  const channelIds = memberships.map((item) => item.channelId)
  const channels = await db
    .select()
    .from(chatChannels)
    .where(inArray(chatChannels.id, channelIds))
    .orderBy(desc(chatChannels.updatedAt))

  const items: ChatChannel[] = []
  for (const channel of channels) {
    const membership = memberships.find((item) => item.channelId === channel.id)
    const [lastMessageRow] = await db
      .select({
        id: chatMessages.id,
        channelId: chatMessages.channelId,
        authorId: chatMessages.authorId,
        authorFirstName: author.firstName,
        authorLastName: author.lastName,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        editedAt: chatMessages.editedAt,
      })
      .from(chatMessages)
      .innerJoin(author, eq(author.id, chatMessages.authorId))
      .where(eq(chatMessages.channelId, channel.id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1)

    const [memberCountRow] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(chatChannelMembers)
      .where(eq(chatChannelMembers.channelId, channel.id))

    let unreadCount = 0
    if (membership?.lastReadAt) {
      const [unreadRow] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.channelId, channel.id),
            gt(chatMessages.createdAt, membership.lastReadAt),
            sql`${chatMessages.authorId} <> ${userId}`
          )
        )
      unreadCount = Number(unreadRow?.value ?? 0)
    }

    let peerId: string | null = null
    let peerName: string | null = null
    if (channel.type === "direct") {
      const members = await db
        .select({
          userId: chatChannelMembers.userId,
          firstName: users.firstName,
          lastName: users.lastName,
          middleName: employeeProfiles.middleName,
        })
        .from(chatChannelMembers)
        .innerJoin(users, eq(users.id, chatChannelMembers.userId))
        .leftJoin(employeeProfiles, eq(employeeProfiles.userId, users.id))
        .where(eq(chatChannelMembers.channelId, channel.id))

      const peer = members.find((member) => member.userId !== userId)
      if (peer) {
        peerId = peer.userId
        peerName = formatFullName(peer.lastName, peer.firstName, peer.middleName)
      }
    }

    items.push({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      departmentId: channel.departmentId,
      createdBy: channel.createdBy,
      memberCount: Number(memberCountRow?.value ?? 0),
      unreadCount,
      lastMessage: lastMessageRow ? mapMessage(lastMessageRow) : null,
      peerId,
      peerName,
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
    })
  }

  return { items }
}

export async function listChannelMessages(
  channelId: string,
  userId: string,
  limit = 50
): Promise<ChatMessagesListResponse> {
  if (useMockDb()) {
    return {
      channelId,
      items: mockMessages
        .filter((message) => message.channelId === channelId)
        .slice(-limit),
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
      createdAt: chatMessages.createdAt,
      editedAt: chatMessages.editedAt,
    })
    .from(chatMessages)
    .innerJoin(author, eq(author.id, chatMessages.authorId))
    .where(eq(chatMessages.channelId, channelId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit)

  await db
    .update(chatChannelMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))

  return {
    channelId,
    items: rows.reverse().map(mapMessage),
  }
}

export async function createChannel(
  payload: ChatChannelCreatePayload & { createdBy: string }
): Promise<ChatChannel> {
  const uniqueMembers = Array.from(new Set([payload.createdBy, ...payload.memberIds]))

  if (useMockDb()) {
    const channel: ChatChannel = {
      id: crypto.randomUUID(),
      name: payload.name ?? null,
      type: payload.type,
      departmentId: payload.departmentId ?? null,
      createdBy: payload.createdBy,
      memberCount: uniqueMembers.length,
      unreadCount: 0,
      lastMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockChannels.unshift(channel)
    return channel
  }

  const [channel] = await db
    .insert(chatChannels)
    .values({
      name: payload.name ?? null,
      type: payload.type,
      departmentId: payload.departmentId ?? null,
      createdBy: payload.createdBy,
    })
    .returning()

  await db.insert(chatChannelMembers).values(
    uniqueMembers.map((memberId) => ({
      channelId: channel.id,
      userId: memberId,
    }))
  )

  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
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
  body: string
): Promise<ChatMessage> {
  if (useMockDb()) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      channelId,
      authorId: userId,
      authorName: "Вы",
      body,
      createdAt: new Date().toISOString(),
      editedAt: null,
    }
    mockMessages.push(message)
    const channel = mockChannels.find((item) => item.id === channelId)
    if (channel) {
      channel.lastMessage = message
      channel.updatedAt = message.createdAt
    }
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
    .values({ channelId, authorId: userId, body })
    .returning({ id: chatMessages.id })

  await db
    .update(chatChannels)
    .set({ updatedAt: new Date() })
    .where(eq(chatChannels.id, channelId))

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
      createdAt: chatMessages.createdAt,
      editedAt: chatMessages.editedAt,
    })
    .from(chatMessages)
    .innerJoin(author, eq(author.id, chatMessages.authorId))
    .where(eq(chatMessages.id, inserted.id))
    .limit(1)

  if (!row) throw new Error("Не удалось отправить сообщение")
  return mapMessage(row)
}

export async function findOrCreateDirectChannel(
  userId: string,
  peerId: string
): Promise<ChatChannel> {
  if (useMockDb()) {
    const existing = mockChannels.find(
      (channel) =>
        channel.type === "direct" &&
        mockMessages.some((msg) => msg.channelId === channel.id)
    )
    if (existing) return existing
    return createChannel({
      type: "direct",
      memberIds: [peerId],
      createdBy: userId,
    })
  }

  const myMemberships = await db
    .select({ channelId: chatChannelMembers.channelId })
    .from(chatChannelMembers)
    .where(eq(chatChannelMembers.userId, userId))

  for (const membership of myMemberships) {
    const [channel] = await db
      .select()
      .from(chatChannels)
      .where(and(eq(chatChannels.id, membership.channelId), eq(chatChannels.type, "direct")))
      .limit(1)
    if (!channel) continue

    const members = await db
      .select({ userId: chatChannelMembers.userId })
      .from(chatChannelMembers)
      .where(eq(chatChannelMembers.channelId, channel.id))

    const memberIds = members.map((item) => item.userId).sort()
    const expected = [userId, peerId].sort()
    if (memberIds.length === 2 && memberIds[0] === expected[0] && memberIds[1] === expected[1]) {
      const listed = await listMyChannels(userId)
      const found = listed.items.find((item) => item.id === channel.id)
      if (found) return found
    }
  }

  return createChannel({
    type: "direct",
    memberIds: [peerId],
    createdBy: userId,
  }).then(async (created) => {
    const listed = await listMyChannels(userId)
    return listed.items.find((item) => item.id === created.id) ?? created
  })
}
