import type { ChatMessage } from "@/types/portal"

export type RealtimeEvent =
  | {
      type: "message.new"
      channelId: string
      message: ChatMessage
      memberIds: string[]
    }
  | {
      type: "message.updated"
      channelId: string
      message: ChatMessage
      memberIds: string[]
    }
  | {
      type: "message.deleted"
      channelId: string
      messageId: string
      memberIds: string[]
    }
  | {
      type: "channel.updated"
      channelId: string
      memberIds: string[]
    }
  | {
      type: "typing.start"
      channelId: string
      userId: string
      userName?: string
      memberIds: string[]
    }
  | {
      type: "read.updated"
      channelId: string
      userId: string
      lastReadAt: string
      memberIds: string[]
    }
  | {
      type: "notification.new"
      userId: string
      notification: {
        id: string
        type: string
        title: string
        entityType: string | null
        entityId: string | null
        createdAt: string
      }
    }
