import { mockDisplayName } from "@/lib/auth/mock-users"
import type { UserRole } from "@/types/auth"
import type { ChatChannel, ChatChannelMember, ChatMessage, ChatMessageType } from "@/types/portal"

interface MockChannelRecord {
  id: string
  name: string | null
  type: ChatChannel["type"]
  taskId: string | null
  departmentId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface MockMembership {
  channelId: string
  userId: string
  lastReadAt: string | null
}

const globalForMockChat = globalThis as unknown as {
  __snarkMockChannels?: MockChannelRecord[]
  __snarkMockMessages?: ChatMessage[]
  __snarkMockMemberships?: MockMembership[]
  __snarkMockDirectKeys?: Map<string, string>
}

if (!globalForMockChat.__snarkMockChannels) {
  globalForMockChat.__snarkMockChannels = []
  globalForMockChat.__snarkMockMessages = []
  globalForMockChat.__snarkMockMemberships = []
  globalForMockChat.__snarkMockDirectKeys = new Map()
}

const channels = globalForMockChat.__snarkMockChannels!
const messages = globalForMockChat.__snarkMockMessages!
const memberships = globalForMockChat.__snarkMockMemberships!
const directChannelKeys = globalForMockChat.__snarkMockDirectKeys!

const EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000

function userName(userId: string): string {
  return mockDisplayName(userId)
}

function directKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(":")
}

function isMember(channelId: string, userId: string): boolean {
  return memberships.some((item) => item.channelId === channelId && item.userId === userId)
}

function memberIds(channelId: string): string[] {
  return memberships.filter((item) => item.channelId === channelId).map((item) => item.userId)
}

function canBypassWindow(role?: UserRole): boolean {
  return role === "admin" || role === "hr_manager"
}

function assertWindow(createdAt: string, role?: UserRole): void {
  if (canBypassWindow(role)) return
  if (Date.now() - new Date(createdAt).getTime() > EDIT_DELETE_WINDOW_MS) {
    throw new Error("Редактирование/удаление доступно только в течение 15 минут")
  }
}

function enrichChannel(channel: MockChannelRecord, viewerId: string): ChatChannel {
  const channelMessages = messages.filter((message) => message.channelId === channel.id)
  const lastMessage = channelMessages.length > 0 ? channelMessages[channelMessages.length - 1] : null
  const members = memberIds(channel.id)
  const membership = memberships.find(
    (item) => item.channelId === channel.id && item.userId === viewerId
  )
  const lastReadAt = membership?.lastReadAt ?? null

  let peerId: string | null = null
  let peerName: string | null = null
  if (channel.type === "direct") {
    peerId = members.find((id) => id !== viewerId) ?? null
    peerName = peerId ? userName(peerId) : null
  }

  const unreadCount = channelMessages.filter((message) => {
    if (message.authorId === viewerId || message.messageType !== "user") return false
    if (lastReadAt == null) return true
    return new Date(message.createdAt) > new Date(lastReadAt)
  }).length

  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    taskId: channel.taskId,
    departmentId: channel.departmentId,
    createdBy: channel.createdBy,
    memberCount: members.length,
    unreadCount,
    lastMessage,
    peerId,
    peerName,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  }
}

function addMembers(
  channelId: string,
  userIds: string[],
  options?: { creatorId?: string; markCreatorRead?: boolean }
): void {
  const unique = Array.from(new Set(userIds))
  for (const userId of unique) {
    if (isMember(channelId, userId)) continue
    const isCreator = options?.creatorId === userId && options.markCreatorRead
    memberships.push({
      channelId,
      userId,
      // Новый участник с null → полный unread истории
      lastReadAt: isCreator ? new Date().toISOString() : null,
    })
  }
}

export function mockListChannelsForUser(userId: string): ChatChannel[] {
  const channelIds = new Set(
    memberships.filter((item) => item.userId === userId).map((item) => item.channelId)
  )
  return channels
    .filter((channel) => channelIds.has(channel.id))
    .map((channel) => enrichChannel(channel, userId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function mockGetChannelByTaskId(taskId: string): string | null {
  return channels.find((channel) => channel.taskId === taskId)?.id ?? null
}

export function mockCreateChannel(params: {
  name: string | null
  type: ChatChannel["type"]
  taskId?: string | null
  departmentId?: string | null
  createdBy: string
  memberIds: string[]
}): ChatChannel {
  const now = new Date().toISOString()
  const channel: MockChannelRecord = {
    id: crypto.randomUUID(),
    name: params.name,
    type: params.type,
    taskId: params.taskId ?? null,
    departmentId: params.departmentId ?? null,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  }
  channels.unshift(channel)
  addMembers(channel.id, [params.createdBy, ...params.memberIds], {
    creatorId: params.createdBy,
    markCreatorRead: true,
  })

  if (params.type === "direct") {
    const members = memberIds(channel.id)
    if (members.length === 2) {
      directChannelKeys.set(directKey(members[0], members[1]), channel.id)
    }
  }

  return enrichChannel(channel, params.createdBy)
}

export function mockFindOrCreateDirectChannel(userId: string, peerId: string): ChatChannel {
  const key = directKey(userId, peerId)
  const existingId = directChannelKeys.get(key)
  if (existingId) {
    const channel = channels.find((item) => item.id === existingId)
    if (channel) return enrichChannel(channel, userId)
  }

  return mockCreateChannel({
    type: "direct",
    name: null,
    createdBy: userId,
    memberIds: [peerId],
  })
}

export function mockEnsureTaskChannel(params: {
  taskId: string
  title: string
  creatorId: string
  assigneeId: string | null
  participantIds?: string[]
}): string {
  const existingId = mockGetChannelByTaskId(params.taskId)
  if (existingId) {
    const memberList = collectTaskMembers(params)
    addMembers(existingId, memberList)
    return existingId
  }

  const channel = mockCreateChannel({
    type: "task",
    name: params.title,
    taskId: params.taskId,
    createdBy: params.creatorId,
    memberIds: collectTaskMembers(params).filter((id) => id !== params.creatorId),
  })

  mockPostSystemMessage(channel.id, params.creatorId, `Создан чат задачи «${params.title}»`)
  return channel.id
}

function collectTaskMembers(params: {
  creatorId: string
  assigneeId: string | null
  participantIds?: string[]
}): string[] {
  const ids = new Set<string>([params.creatorId])
  if (params.assigneeId) ids.add(params.assigneeId)
  for (const id of params.participantIds ?? []) ids.add(id)
  return Array.from(ids)
}

export function mockAddChannelMembers(
  channelId: string,
  actorUserId: string,
  newMemberIds: string[]
): ChatChannel | null {
  const channel = channels.find((item) => item.id === channelId)
  if (!channel || !isMember(channelId, actorUserId)) return null
  if (channel.type === "direct") return null

  addMembers(channelId, newMemberIds)
  channel.updatedAt = new Date().toISOString()
  return enrichChannel(channel, actorUserId)
}

export function mockRemoveChannelMembers(
  channelId: string,
  actorUserId: string,
  removeIds: string[]
): ChatChannel | null {
  const channel = channels.find((item) => item.id === channelId)
  if (!channel || !isMember(channelId, actorUserId)) return null
  if (channel.type === "direct") return null

  for (const userId of removeIds) {
    if (userId === channel.createdBy) continue
    const index = memberships.findIndex(
      (item) => item.channelId === channelId && item.userId === userId
    )
    if (index >= 0) memberships.splice(index, 1)
  }
  channel.updatedAt = new Date().toISOString()
  return enrichChannel(channel, actorUserId)
}

export function mockMarkChannelRead(channelId: string, userId: string): void {
  const membership = memberships.find(
    (item) => item.channelId === channelId && item.userId === userId
  )
  if (membership) membership.lastReadAt = new Date().toISOString()
}

export function mockListMessages(channelId: string, userId: string, limit = 50): ChatMessage[] {
  if (!isMember(channelId, userId)) {
    throw new Error("Нет доступа к каналу")
  }
  return messages.filter((message) => message.channelId === channelId).slice(-limit)
}

export function mockSendMessage(
  channelId: string,
  userId: string,
  body: string,
  options?: {
    replyToId?: string | null
    messageType?: ChatMessageType
    metadata?: Record<string, unknown> | null
  }
): ChatMessage {
  if (!isMember(channelId, userId)) {
    throw new Error("Нет доступа к каналу")
  }

  const channel = channels.find((item) => item.id === channelId)
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    channelId,
    authorId: userId,
    authorName: "Вы",
    body,
    messageType: options?.messageType ?? "user",
    replyToId: options?.replyToId ?? null,
    replyToBody: null,
    linkedTaskId: null,
    metadata: options?.metadata ?? null,
    createdAt: new Date().toISOString(),
    editedAt: null,
  }
  messages.push(message)
  mockMarkChannelRead(channelId, userId)
  if (channel) channel.updatedAt = message.createdAt
  return message
}

export function mockPostSystemMessage(channelId: string, actorId: string, body: string): void {
  if (!isMember(channelId, actorId)) {
    addMembers(channelId, [actorId], { creatorId: actorId, markCreatorRead: true })
  }
  mockSendMessage(channelId, actorId, body, { messageType: "system" })
}

export function mockGetMessageById(messageId: string): ChatMessage | null {
  return messages.find((message) => message.id === messageId) ?? null
}

export function mockEditMessage(
  channelId: string,
  messageId: string,
  userId: string,
  body: string,
  role?: UserRole
): ChatMessage | null {
  const message = messages.find((item) => item.id === messageId && item.channelId === channelId)
  if (!message) return null
  if (!isMember(channelId, userId)) throw new Error("Нет доступа к каналу")
  if (message.authorId !== userId) throw new Error("Можно редактировать только свои сообщения")
  if (message.messageType !== "user") throw new Error("Системные сообщения нельзя редактировать")
  assertWindow(message.createdAt, role)
  message.body = body
  message.editedAt = new Date().toISOString()
  return message
}

export function mockDeleteMessage(
  channelId: string,
  messageId: string,
  userId: string,
  role?: UserRole
): boolean {
  const index = messages.findIndex((item) => item.id === messageId && item.channelId === channelId)
  if (index < 0) return false
  const message = messages[index]
  if (!isMember(channelId, userId)) throw new Error("Нет доступа к каналу")
  if (message.authorId !== userId) throw new Error("Можно удалять только свои сообщения")
  if (message.messageType !== "user") throw new Error("Системные сообщения нельзя удалять")
  assertWindow(message.createdAt, role)
  messages.splice(index, 1)
  return true
}

export function mockUserCanAccessChannel(channelId: string, userId: string): boolean {
  return isMember(channelId, userId)
}

export function getMockChannelMemberIds(channelId: string): string[] {
  return memberIds(channelId)
}

export function mockListChannelMembers(
  channelId: string,
  viewerId: string
): ChatChannelMember[] | null {
  if (!isMember(channelId, viewerId)) return null
  return memberships
    .filter((item) => item.channelId === channelId)
    .map((item) => ({
      userId: item.userId,
      name: userName(item.userId),
      position: null,
      department: null,
      joinedAt: null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
}
