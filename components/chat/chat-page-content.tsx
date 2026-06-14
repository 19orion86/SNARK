"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { ChatChannel, ChatMessage, ChatChannelsListResponse } from "@/types/portal"

interface ChatPageContentProps {
  initial: ChatChannelsListResponse
}

function formatTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function ChatPageContent({ initial }: ChatPageContentProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [channels, setChannels] = useState(initial.items)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(initial.items[0]?.id ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageBody, setMessageBody] = useState("")
  const [groupName, setGroupName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)

  const loadMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true)
    try {
      const response = await fetch(`/api/chat/channels/${channelId}/messages`)
      if (!response.ok) {
        setError("Не удалось загрузить сообщения")
        return
      }
      const data = (await response.json()) as { items: ChatMessage[] }
      setMessages(data.items)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (activeChannelId) {
      void loadMessages(activeChannelId)
    }
  }, [activeChannelId, loadMessages])

  useEffect(() => {
    const timer = setInterval(() => {
      if (activeChannelId) {
        void loadMessages(activeChannelId)
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [activeChannelId, loadMessages])

  const refreshChannels = async () => {
    const response = await fetch("/api/chat/channels")
    if (!response.ok) return
    const data = (await response.json()) as ChatChannelsListResponse
    setChannels(data.items)
    if (!activeChannelId && data.items[0]) {
      setActiveChannelId(data.items[0].id)
    }
  }

  const createGroup = async () => {
    setError(null)
    const response = await fetch("/api/chat/channels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "group",
        name: groupName.trim() || "Общий чат",
        memberIds: [],
      }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? "Не удалось создать чат")
      return
    }
    const body = (await response.json()) as { item: ChatChannel }
    setGroupName("")
    await refreshChannels()
    setActiveChannelId(body.item.id)
    startTransition(() => router.refresh())
  }

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeChannelId || !messageBody.trim()) return
    setError(null)
    const response = await fetch(`/api/chat/channels/${activeChannelId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: messageBody.trim() }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? "Не удалось отправить сообщение")
      return
    }
    setMessageBody("")
    await loadMessages(activeChannelId)
    await refreshChannels()
  }

  const activeChannel = channels.find((channel) => channel.id === activeChannelId) ?? null

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="p-4">
        <h1 className="text-xl font-semibold">Чат</h1>
        <p className="mt-1 text-sm text-muted-foreground">Внутренняя переписка сотрудников</p>

        <div className="mt-4 space-y-2">
          <Input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="Название группового чата"
          />
          <Button className="w-full" onClick={createGroup} disabled={pending}>
            Создать групповой чат
          </Button>
        </div>

        <ScrollArea className="mt-4 h-[420px]">
          <div className="space-y-1">
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">Каналов пока нет</p>
            ) : (
              channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setActiveChannelId(channel.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    activeChannelId === channel.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="font-medium">{channel.name ?? "Личный чат"}</div>
                  <div className="truncate text-xs opacity-80">
                    {channel.lastMessage?.body ?? "Нет сообщений"}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex min-h-[560px] flex-col p-4">
        <div className="border-b pb-3">
          <h2 className="text-lg font-semibold">
            {activeChannel?.name ?? "Выберите канал"}
          </h2>
        </div>

        <ScrollArea className="flex-1 py-4">
          {loadingMessages ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Сообщений пока нет</p>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="rounded-lg bg-muted px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{message.authorName}</span>
                    <span>{formatTime(message.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <form onSubmit={sendMessage} className="mt-4 flex gap-2 border-t pt-4">
          <Input
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            placeholder="Напишите сообщение..."
            disabled={!activeChannelId}
          />
          <Button type="submit" disabled={!activeChannelId || !messageBody.trim()}>
            Отправить
          </Button>
        </form>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </Card>
    </div>
  )
}
