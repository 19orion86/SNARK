"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  DoorOpen,
  FileText,
  HelpCircle,
  Newspaper,
  Pin,
  Settings2,
  Users,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BirthdayWidget } from "@/components/widgets/BirthdayWidget"
import { NewEmployeesWidget } from "@/components/widgets/NewEmployeesWidget"
import {
  DashboardWidgetsEditor,
  type WidgetConfigItem,
} from "@/components/widgets/dashboard-widgets-editor"
import type { DashboardData } from "@/types/portal"

const iconMap = {
  Users,
  FileText,
  Calendar,
  HelpCircle,
  BookOpen,
  Newspaper,
  DoorOpen,
} as const

const NEWS_CATEGORY_LABELS: Record<string, string> = {
  company: "Компания",
  projects: "Проекты",
  people: "Люди",
  important: "Важно",
}

const DEFAULT_WIDGETS: WidgetConfigItem[] = [
  { widgetType: "news", sortOrder: 0, enabled: true },
  { widgetType: "birthdays", sortOrder: 1, enabled: true },
  { widgetType: "new_hires", sortOrder: 2, enabled: true },
  { widgetType: "my_tasks", sortOrder: 3, enabled: true },
  { widgetType: "overdue", sortOrder: 4, enabled: true },
  { widgetType: "unread_chats", sortOrder: 5, enabled: false },
]

function newsCategoryLabel(category: string): string {
  return NEWS_CATEGORY_LABELS[category] ?? category
}

function formatNewsDate(value: string | null | undefined): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("ru-RU")
}

function isEnabled(widgets: WidgetConfigItem[], type: WidgetConfigItem["widgetType"]): boolean {
  const item = widgets.find((w) => w.widgetType === type)
  return item?.enabled ?? true
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const [widgets, setWidgets] = useState<WidgetConfigItem[]>(DEFAULT_WIDGETS)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [overdueCount, setOverdueCount] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const response = await fetch("/api/dashboard/widgets")
        if (!response.ok) return
        const body = (await response.json()) as { items: WidgetConfigItem[] }
        if (mounted && body.items?.length) {
          setWidgets(
            [...body.items].sort((a, b) => a.sortOrder - b.sortOrder)
          )
        }
      } catch {
        // keep defaults
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const response = await fetch("/api/dashboard")
        if (!response.ok) return
        const body = (await response.json()) as {
          overdueTasks?: { total?: number }
          notifications?: { unreadCount?: number }
        }
        if (!mounted) return
        setOverdueCount(body.overdueTasks?.total ?? 0)
        setUnreadChats(body.notifications?.unreadCount ?? 0)
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const saveWidgets = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/dashboard/widgets", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: widgets.map((item, sortOrder) => ({
            ...item,
            sortOrder,
          })),
        }),
      })
      if (response.ok) {
        const body = (await response.json()) as { items: WidgetConfigItem[] }
        if (body.items?.length) setWidgets([...body.items].sort((a, b) => a.sortOrder - b.sortOrder))
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const now = new Date()
  const currentDate = now.toLocaleDateString("ru-RU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const hour = now.getHours()
  const greeting =
    hour < 6
      ? "Доброй ночи"
      : hour < 12
        ? "Доброе утро"
        : hour < 18
          ? "Добрый день"
          : "Добрый вечер"

  const pinnedHero = data.recentNews.find((n) => n.isPinned) ?? null
  const restNews = pinnedHero
    ? data.recentNews.filter((n) => n.id !== pinnedHero.id)
    : data.recentNews

  const orderedSidebar = useMemo(() => {
    return [...widgets]
      .filter((w) => w.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((w) =>
        ["birthdays", "new_hires", "my_tasks", "overdue", "unread_chats"].includes(w.widgetType)
      )
  }, [widgets])

  const showNews = isEnabled(widgets, "news")

  return (
    <div className="space-y-6">
      <div
        className="relative overflow-hidden rounded-xl p-6 md:p-8"
        style={{ background: "linear-gradient(135deg, #16223b 0%, #28367b 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <svg className="h-full w-full" viewBox="0 0 400 200">
            <path d="M0 100 Q 100 50, 200 100 T 400 100" stroke="#6f9ed4" strokeWidth="2" fill="none" />
            <path d="M0 150 Q 100 100, 200 150 T 400 150" stroke="#6f9ed4" strokeWidth="1" fill="none" />
            <path d="M0 50 Q 100 0, 200 50 T 400 50" stroke="#6f9ed4" strokeWidth="1" fill="none" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">
              {greeting}, {data.welcomeName}!
            </h1>
            <p className="mt-2 text-white/70">{currentDate}</p>
            {data.birthdays.today.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-white/80">
                <span aria-hidden="true">🎂</span>
                <span>
                  Сегодня день рождения: {data.birthdays.today.map((b) => b.name).join(", ")}
                </span>
              </div>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setEditing((v) => !v)}
          >
            <Settings2 className="mr-1 h-4 w-4" />
            {editing ? "Скрыть" : "Виджеты"}
          </Button>
        </div>
      </div>

      {editing ? (
        <DashboardWidgetsEditor
          items={widgets}
          onChange={setWidgets}
          onSave={() => void saveWidgets()}
          saving={saving}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {data.quickActions.map((action) => {
          const Icon = iconMap[action.icon as keyof typeof iconMap] ?? Users
          return (
            <Link
              key={action.label}
              href={action.href}
              className="group flex flex-col items-center gap-3 rounded-xl bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="rounded-lg bg-primary/10 p-3 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-center text-sm font-medium text-card-foreground">
                {action.label}
              </span>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {showNews ? (
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="text-lg font-bold text-card-foreground">Последние новости</h2>
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              {data.recentNews.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Newspaper className="mb-2 h-10 w-10 opacity-40" aria-hidden="true" />
                  <p className="text-sm">Пока нет опубликованных новостей</p>
                </div>
              ) : (
                <>
                  {pinnedHero && (
                    <Link
                      href={`/news/${pinnedHero.id}`}
                      className="block border-b border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#16223b] to-[#28367b]">
                          <Newspaper className="h-7 w-7 text-white opacity-40" aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                            <Pin className="h-3 w-3" aria-hidden="true" />
                            Важно
                          </span>
                          <h3 className="mt-2 line-clamp-2 font-semibold text-card-foreground">
                            {pinnedHero.title}
                          </h3>
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatNewsDate(pinnedHero.publishedAt ?? pinnedHero.createdAt)}</span>
                            <span>{newsCategoryLabel(pinnedHero.category)}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </div>
                    </Link>
                  )}
                  <div className="divide-y divide-border">
                    {restNews.map((news) => (
                      <Link
                        key={news.id}
                        href={`/news/${news.id}`}
                        className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#16223b] to-[#28367b]">
                          <Newspaper className="h-6 w-6 text-white opacity-40" aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                          <h3 className="line-clamp-2 font-medium text-card-foreground">{news.title}</h3>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatNewsDate(news.publishedAt ?? news.createdAt)}
                            </span>
                            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                              {newsCategoryLabel(news.category)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </>
              )}
              <div className="border-t border-border p-4">
                <Link
                  href="/news"
                  className="block w-full rounded-lg border border-border py-2.5 text-center text-sm font-medium text-primary transition-colors hover:bg-muted"
                >
                  Все новости
                </Link>
              </div>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-2" />
        )}

        <div className="space-y-6">
          {orderedSidebar.map((widget) => {
            if (widget.widgetType === "birthdays") {
              return <BirthdayWidget key="birthdays" data={data.birthdays} />
            }
            if (widget.widgetType === "new_hires") {
              return <NewEmployeesWidget key="new_hires" items={data.newEmployees} />
            }
            if (widget.widgetType === "my_tasks") {
              return (
                <Card key="my_tasks" className="p-4">
                  <h3 className="mb-4 font-bold text-card-foreground">Мои задачи</h3>
                  <div className="space-y-3">
                    {data.myTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Нет активных задач</p>
                    ) : (
                      data.myTasks.map((task, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-lg border border-border p-3"
                        >
                          <CheckCircle
                            className={`h-5 w-5 shrink-0 ${
                              task.priority === "high"
                                ? "text-destructive"
                                : task.priority === "medium"
                                  ? "text-accent"
                                  : "text-muted-foreground"
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium text-card-foreground">{task.title}</p>
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{task.deadline}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              )
            }
            if (widget.widgetType === "overdue") {
              return (
                <Card key="overdue" className="p-4">
                  <h3 className="mb-2 font-bold text-card-foreground">Просроченные</h3>
                  <p className="text-sm text-muted-foreground">
                    {overdueCount > 0 ? (
                      <Link href="/tasks?scope=overdue" className="text-destructive hover:underline">
                        {overdueCount} задач требуют внимания
                      </Link>
                    ) : (
                      "Просроченных задач нет"
                    )}
                  </p>
                </Card>
              )
            }
            if (widget.widgetType === "unread_chats") {
              return (
                <Card key="unread_chats" className="p-4">
                  <h3 className="mb-2 font-bold text-card-foreground">Чаты</h3>
                  <p className="text-sm text-muted-foreground">
                    <Link href="/chat" className="hover:underline">
                      Непрочитанных: {unreadChats}
                    </Link>
                  </p>
                </Card>
              )
            }
            return null
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {data.serviceCards.map((service) => {
          const Icon = iconMap[service.icon as keyof typeof iconMap] ?? Users
          return (
            <Link
              key={service.title}
              href={service.href}
              className="group relative overflow-hidden rounded-xl bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`mb-4 inline-flex rounded-lg p-3 ${service.color} text-white`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-card-foreground">{service.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
              <ChevronRight className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
