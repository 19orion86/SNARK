"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell, BellRing } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRealtimeEvents } from "@/hooks/use-realtime-events"

interface PortalNotification {
  id: string
  type: string
  title: string
  entityType: string | null
  entityId: string | null
  readAt: string | null
  createdAt: string
}

function entityHref(item: PortalNotification): string | null {
  if (item.entityType === "task" && item.entityId) return `/tasks/${item.entityId}`
  if (item.entityType === "chat_channel" && item.entityId) {
    return `/chat?channel=${item.entityId}`
  }
  return null
}

function formatWhen(value: string): string {
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function NotificationBell() {
  const [items, setItems] = useState<PortalNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushLabel, setPushLabel] = useState("Push")

  const load = useCallback(async () => {
    const response = await fetch("/api/notifications")
    if (!response.ok) return
    const data = (await response.json()) as {
      items: PortalNotification[]
      unreadCount: number
    }
    setItems(data.items)
    setUnreadCount(data.unreadCount)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeEvents({
    onEvent: (event) => {
      if (event.type === "notification.new") {
        setItems((prev) => [
          {
            id: event.notification.id,
            type: event.notification.type,
            title: event.notification.title,
            entityType: event.notification.entityType,
            entityId: event.notification.entityId,
            readAt: null,
            createdAt: event.notification.createdAt,
          },
          ...prev,
        ].slice(0, 20))
        setUnreadCount((count) => count + 1)
      }
    },
    onFallbackPoll: () => {
      void load()
    },
  })

  const markAllRead = async () => {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    })
    if (!response.ok) return
    setUnreadCount(0)
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })))
  }

  const markOneRead = async (id: string) => {
    const response = await fetch(`/api/notifications/${id}`, { method: "PATCH" })
    if (!response.ok) return
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item
      )
    )
    setUnreadCount((count) => Math.max(0, count - 1))
  }

  const subscribePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushLabel("Нет поддержки")
      return
    }
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setPushLabel("Запрещено")
        return
      }
      const keyRes = await fetch("/api/push/vapid-public-key")
      if (!keyRes.ok) {
        setPushLabel("Нет ключа")
        return
      }
      const { publicKey } = (await keyRes.json()) as { publicKey?: string | null }
      if (!publicKey) {
        setPushLabel("Нет ключа")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
      const json = subscription.toJSON()
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          },
        }),
      })
      setPushLabel(response.ok ? "Подключено" : "Ошибка")
    } catch {
      setPushLabel("Ошибка")
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="hidden text-white/90 hover:bg-white/10 hover:text-white sm:inline-flex"
        disabled={pushBusy}
        onClick={() => void subscribePush()}
        title="Подписка на push"
      >
        <BellRing className="mr-1 h-4 w-4" />
        {pushLabel}
      </Button>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative text-white/90 hover:bg-white/10 hover:text-white"
          aria-label="Уведомления"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Уведомления</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-xs font-normal text-primary hover:underline"
              onClick={() => void markAllRead()}
            >
              Прочитать все
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">Пока пусто</div>
        ) : (
          items.map((item) => {
            const href = entityHref(item)
            const content = (
              <div className="flex flex-col gap-0.5">
                <span className={item.readAt ? "text-muted-foreground" : "font-medium"}>
                  {item.title}
                </span>
                <span className="text-[11px] text-muted-foreground">{formatWhen(item.createdAt)}</span>
              </div>
            )
            return (
              <DropdownMenuItem
                key={item.id}
                className="cursor-pointer items-start py-2"
                onSelect={() => {
                  if (!item.readAt) void markOneRead(item.id)
                  setOpen(false)
                }}
              >
                {href ? (
                  <Link href={href} className="block w-full" onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  )
}
