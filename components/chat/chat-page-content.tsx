"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MessageSquare, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type {
  ChatChannel,
  ChatChannelsListResponse,
  ChatMessage,
  Employee,
} from "@/types/portal"

interface ChatPageContentProps {
  initial: ChatChannelsListResponse
  employees: Employee[]
  currentUserId: string
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

function channelTitle(channel: ChatChannel): string {
  if (channel.type === "direct") {
    return channel.peerName ?? "Личный чат"
  }
  return channel.name ?? "Групповой чат"
}

export function ChatPageContent({ initial, employees, currentUserId }: ChatPageContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [channels, setChannels] = useState(initial.items)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(initial.items[0]?.id ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageBody, setMessageBody] = useState("")
  const [groupName, setGroupName] = useState("")
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [openingDirect, setOpeningDirect] = useState(false)

  const colleagues = useMemo(
    () => employees.filter((employee) => employee.userId !== currentUserId),
    [employees, currentUserId]
  )

  const filteredColleagues = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase()
    if (!query) return colleagues.slice(0, 8)
    return colleagues
      .filter(
        (employee) =>
          employee.name.toLowerCase().includes(query) ||
          employee.position.toLowerCase().includes(query) ||
          employee.email.toLowerCase().includes(query)
      )
      .slice(0, 12)
  }, [colleagues, employeeSearch])

  const directChannels = useMemo(
    () => channels.filter((channel) => channel.type === "direct"),
    [channels]
  )
  const groupChannels = useMemo(
    () => channels.filter((channel) => channel.type !== "direct"),
    [channels]
  )

  const loadMessages = useCallback(async (channelId: string, silent = false) => {
    if (!silent) setLoadingMessages(true)
    try {
      const response = await fetch(`/api/chat/channels/${channelId}/messages`)
      if (!response.ok) {
        if (!silent) setError("Не удалось загрузить сообщения")
        return
      }
      const data = (await response.json()) as { items: ChatMessage[] }
      setMessages(data.items)
      setError(null)
    } finally {
      if (!silent) setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (activeChannelId) {
      void loadMessages(activeChannelId)
    } else {
      setMessages([])
    }
  }, [activeChannelId, loadMessages])

  useEffect(() => {
    const timer = setInterval(() => {
      if (activeChannelId) {
        void loadMessages(activeChannelId, true)
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [activeChannelId, loadMessages])

  const refreshChannels = useCallback(async () => {
    const response = await fetch("/api/chat/channels")
    if (!response.ok) return
    const data = (await response.json()) as ChatChannelsListResponse
    setChannels(data.items)
    return data.items
  }, [])

  const openDirectChat = useCallback(
    async (peerId: string) => {
      if (peerId === currentUserId) return
      setOpeningDirect(true)
      setError(null)
      try {
        const response = await fetch("/api/chat/direct", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ peerId }),
        })
        const body = (await response.json().catch(() => ({}))) as { item?: ChatChannel; error?: string }
        if (!response.ok || !body.item) {
          setError(body.error ?? "Не удалось открыть диалог")
          return
        }
        const updated = await refreshChannels()
        setActiveChannelId(body.item.id)
        if (!updated?.some((channel) => channel.id === body.item?.id)) {
          setChannels((prev) => [body.item!, ...prev])
        }
        setEmployeeSearch("")
        startTransition(() => router.replace("/chat"))
      } catch {
        setError("Сетевая ошибка при открытии диалога")
      } finally {
        setOpeningDirect(false)
      }
    },
    [currentUserId, refreshChannels, router]
  )

  useEffect(() => {
    const peerId = searchParams.get("peer")
    if (peerId && peerId !== currentUserId) {
      void openDirectChat(peerId)
    }
  }, [searchParams, currentUserId, openDirectChat])

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
    await loadMessages(activeChannelId, true)
    await refreshChannels()
  }

  const activeChannel = channels.find((channel) => channel.id === activeChannelId) ?? null

  const renderChannelButton = (channel: ChatChannel) => (
    <button
      key={channel.id}
      type="button"
      onClick={() => setActiveChannelId(channel.id)}
      className={cn(
        "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
        activeChannelId === channel.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{channelTitle(channel)}</span>
        {channel.unreadCount > 0 ? (
          <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
            {channel.unreadCount}
          </span>
        ) : null}
      </div>
      <div className="truncate text-xs opacity-80">
        {channel.lastMessage?.body ?? "Нет сообщений"}
      </div>
    </button>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card className="flex flex-col p-4">
        <h1 className="text-xl font-semibold">Чат</h1>
        <p className="mt-1 text-sm text-muted-foreground">Личные сообщения и групповые чаты</p>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="employee-search">
            Написать сотруднику
          </label>
          <Input
            id="employee-search"
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
            placeholder="Поиск по имени или должности..."
            disabled={openingDirect}
          />
          {filteredColleagues.length > 0 ? (
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-1">
              {filteredColleagues.map((employee) => (
                <button
                  key={employee.userId}
                  type="button"
                  disabled={openingDirect}
                  onClick={() => void openDirectChat(employee.userId)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{employee.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{employee.position}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Сотрудники не найдены</p>
          )}
        </div>

        <ScrollArea className="mt-4 flex-1">
          <div className="space-y-4 pr-2">
            <div>
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                Личные
              </p>
              <div className="space-y-1">
                {directChannels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Диалогов пока нет</p>
                ) : (
                  directChannels.map(renderChannelButton)
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                Групповые
              </p>
              <div className="space-y-1">
                {groupChannels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Групп пока нет</p>
                ) : (
                  groupChannels.map(renderChannelButton)
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="mt-4 space-y-2 border-t pt-4">
          <Input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="Название группового чата"
          />
          <Button className="w-full" variant="outline" onClick={createGroup} disabled={pending}>
            Создать групповой чат
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-[560px] flex-col p-4">
        <div className="border-b pb-3">
          <h2 className="text-lg font-semibold">
            {activeChannel ? channelTitle(activeChannel) : "Выберите диалог"}
          </h2>
          {activeChannel?.type === "direct" ? (
            <p className="text-sm text-muted-foreground">Личная переписка</p>
          ) : activeChannel ? (
            <p className="text-sm text-muted-foreground">
              Участников: {activeChannel.memberCount}
            </p>
          ) : null}
        </div>

        <ScrollArea className="flex-1 py-4">
          {!activeChannelId ? (
            <p className="text-sm text-muted-foreground">
              Выберите сотрудника слева или начните новый диалог через поиск.
            </p>
          ) : loadingMessages && messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Сообщений пока нет. Напишите первым.</p>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const isMine = message.authorId === currentUserId
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2",
                      isMine ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between gap-2 text-xs",
                        isMine ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      <span className="font-medium">{isMine ? "Вы" : message.authorName}</span>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
                  </div>
                )
              })}
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
