import "server-only"
import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db/client"
import {
  chatChannelMembers,
  chatChannels,
  chatMessages,
  chatPollOptions,
  chatPolls,
  chatPollVotes,
  users,
} from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { formatFullName } from "@/lib/portal-data/format-name"
import { getRealtimeBus } from "@/lib/realtime/bus"
import { assertMessageRateLimit } from "@/lib/realtime/rate-limit"
import { listChannelMemberIds } from "@/lib/repositories/chat.repository"
import type { ChatMessage, ChatPollSummary } from "@/types/portal"

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

function buildPollSummary(
  poll: {
    id: string
    question: string
    allowMultiple: boolean
    closesAt: Date | null
  },
  options: Array<{ id: string; label: string; sortOrder: number }>,
  votes: Array<{ optionId: string; userId: string }>,
  userId: string
): ChatPollSummary {
  const myOptionIds = votes.filter((v) => v.userId === userId).map((v) => v.optionId)
  const counts = new Map<string, number>()
  for (const vote of votes) {
    counts.set(vote.optionId, (counts.get(vote.optionId) ?? 0) + 1)
  }
  return {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    closesAt: poll.closesAt ? poll.closesAt.toISOString() : null,
    totalVotes: votes.length,
    myOptionIds,
    options: options.map((option) => ({
      id: option.id,
      label: option.label,
      sortOrder: option.sortOrder,
      votesCount: counts.get(option.id) ?? 0,
      votedByMe: myOptionIds.includes(option.id),
    })),
  }
}

export async function getPollSummariesForMessages(
  messageIds: string[],
  userId: string
): Promise<Map<string, ChatPollSummary>> {
  const result = new Map<string, ChatPollSummary>()
  if (messageIds.length === 0 || isMockDb()) return result

  const polls = await db
    .select({
      id: chatPolls.id,
      messageId: chatPolls.messageId,
      question: chatPolls.question,
      allowMultiple: chatPolls.allowMultiple,
      closesAt: chatPolls.closesAt,
    })
    .from(chatPolls)
    .where(inArray(chatPolls.messageId, messageIds))

  if (polls.length === 0) return result

  const pollIds = polls.map((p) => p.id)
  const options = await db
    .select({
      id: chatPollOptions.id,
      pollId: chatPollOptions.pollId,
      label: chatPollOptions.label,
      sortOrder: chatPollOptions.sortOrder,
    })
    .from(chatPollOptions)
    .where(inArray(chatPollOptions.pollId, pollIds))
    .orderBy(asc(chatPollOptions.sortOrder))

  const votes = await db
    .select({
      pollId: chatPollVotes.pollId,
      optionId: chatPollVotes.optionId,
      userId: chatPollVotes.userId,
    })
    .from(chatPollVotes)
    .where(inArray(chatPollVotes.pollId, pollIds))

  const optionsByPoll = new Map<string, typeof options>()
  for (const option of options) {
    const list = optionsByPoll.get(option.pollId) ?? []
    list.push(option)
    optionsByPoll.set(option.pollId, list)
  }
  const votesByPoll = new Map<string, typeof votes>()
  for (const vote of votes) {
    const list = votesByPoll.get(vote.pollId) ?? []
    list.push(vote)
    votesByPoll.set(vote.pollId, list)
  }

  for (const poll of polls) {
    result.set(
      poll.messageId,
      buildPollSummary(
        poll,
        optionsByPoll.get(poll.id) ?? [],
        votesByPoll.get(poll.id) ?? [],
        userId
      )
    )
  }
  return result
}

export async function getPollForMessage(
  messageId: string,
  userId: string
): Promise<ChatPollSummary | null> {
  if (isMockDb()) return null
  const map = await getPollSummariesForMessages([messageId], userId)
  return map.get(messageId) ?? null
}

export async function createPoll(
  channelId: string,
  userId: string,
  input: { question: string; options: string[]; allowMultiple?: boolean }
): Promise<{ message: ChatMessage; poll: ChatPollSummary }> {
  const question = input.question.trim()
  const options = input.options.map((o) => o.trim()).filter(Boolean)
  if (!question) throw new Error("Укажите вопрос опроса")
  if (options.length < 2) throw new Error("Нужно минимум 2 варианта ответа")

  assertMessageRateLimit(userId)
  await assertChannelMember(channelId, userId)

  if (isMockDb()) {
    const { mockSendMessage } = await import("@/lib/repositories/chat.mock-store")
    const pollId = crypto.randomUUID()
    const message = mockSendMessage(channelId, userId, `📊 ${question}`, {
      messageType: "poll",
    })
    message.metadata = { pollId }
    message.messageType = "poll"
    const poll: ChatPollSummary = {
      id: pollId,
      question,
      allowMultiple: Boolean(input.allowMultiple),
      closesAt: null,
      totalVotes: 0,
      myOptionIds: [],
      options: options.map((label, index) => ({
        id: crypto.randomUUID(),
        label,
        sortOrder: index,
        votesCount: 0,
        votedByMe: false,
      })),
    }
    const enriched = { ...message, poll }
    const memberIds = await listChannelMemberIds(channelId)
    getRealtimeBus().publish({
      type: "message.new",
      channelId,
      message: enriched,
      memberIds,
    })
    return { message: enriched, poll }
  }

  const [inserted] = await db
    .insert(chatMessages)
    .values({
      channelId,
      authorId: userId,
      body: `📊 ${question}`,
      messageType: "poll",
      metadata: null,
    })
    .returning({ id: chatMessages.id })

  const [poll] = await db
    .insert(chatPolls)
    .values({
      messageId: inserted.id,
      question,
      allowMultiple: Boolean(input.allowMultiple),
    })
    .returning()

  if (!poll) throw new Error("Не удалось создать опрос")

  const optionRows = await db
    .insert(chatPollOptions)
    .values(
      options.map((label, index) => ({
        pollId: poll.id,
        label,
        sortOrder: index,
      }))
    )
    .returning()

  await db
    .update(chatMessages)
    .set({ metadata: { pollId: poll.id } })
    .where(eq(chatMessages.id, inserted.id))

  await db.update(chatChannels).set({ updatedAt: new Date() }).where(eq(chatChannels.id, channelId))
  await db
    .update(chatChannelMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)))

  const [author] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const [row] = await db
    .select({
      id: chatMessages.id,
      channelId: chatMessages.channelId,
      authorId: chatMessages.authorId,
      body: chatMessages.body,
      messageType: chatMessages.messageType,
      replyToId: chatMessages.replyToId,
      metadata: chatMessages.metadata,
      createdAt: chatMessages.createdAt,
      editedAt: chatMessages.editedAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.id, inserted.id))
    .limit(1)

  if (!row) throw new Error("Не удалось создать опрос")

  const summary = buildPollSummary(poll, optionRows, [], userId)
  const message: ChatMessage = {
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    authorName: formatFullName(author?.lastName ?? "", author?.firstName ?? ""),
    body: row.body,
    messageType: "poll",
    replyToId: row.replyToId,
    metadata: { pollId: poll.id },
    poll: summary,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
  }

  const memberIds = await listChannelMemberIds(channelId)
  getRealtimeBus().publish({
    type: "message.new",
    channelId,
    message,
    memberIds,
  })

  return { message, poll: summary }
}

export async function vote(
  pollId: string,
  optionId: string,
  userId: string
): Promise<ChatPollSummary> {
  if (isMockDb()) {
    throw new Error("Голосование недоступно в mock-режиме")
  }

  const [poll] = await db.select().from(chatPolls).where(eq(chatPolls.id, pollId)).limit(1)
  if (!poll) throw new Error("Опрос не найден")

  const [message] = await db
    .select({ channelId: chatMessages.channelId })
    .from(chatMessages)
    .where(eq(chatMessages.id, poll.messageId))
    .limit(1)
  if (!message) throw new Error("Сообщение опроса не найдено")
  await assertChannelMember(message.channelId, userId)

  if (poll.closesAt && poll.closesAt.getTime() < Date.now()) {
    throw new Error("Опрос уже закрыт")
  }

  const [option] = await db
    .select()
    .from(chatPollOptions)
    .where(and(eq(chatPollOptions.id, optionId), eq(chatPollOptions.pollId, pollId)))
    .limit(1)
  if (!option) throw new Error("Вариант ответа не найден")

  if (!poll.allowMultiple) {
    await db.delete(chatPollVotes).where(and(eq(chatPollVotes.pollId, pollId), eq(chatPollVotes.userId, userId)))
  } else {
    const [existing] = await db
      .select({ id: chatPollVotes.id })
      .from(chatPollVotes)
      .where(
        and(
          eq(chatPollVotes.pollId, pollId),
          eq(chatPollVotes.optionId, optionId),
          eq(chatPollVotes.userId, userId)
        )
      )
      .limit(1)
    if (existing) {
      await db.delete(chatPollVotes).where(eq(chatPollVotes.id, existing.id))
      const refreshed = await getPollForMessage(poll.messageId, userId)
      if (!refreshed) throw new Error("Не удалось обновить голос")
      return refreshed
    }
  }

  await db.insert(chatPollVotes).values({ pollId, optionId, userId })
  const refreshed = await getPollForMessage(poll.messageId, userId)
  if (!refreshed) throw new Error("Не удалось сохранить голос")
  return refreshed
}
