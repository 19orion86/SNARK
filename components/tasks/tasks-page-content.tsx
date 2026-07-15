"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Flame, MessageSquare, Paperclip, Play, Trash2 } from "lucide-react"
import { EmployeePicker } from "@/components/shared/employee-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_LABEL,
} from "@/lib/portal-data/tasks-ui"
import { isTaskOverdue } from "@/lib/tasks/overdue"
import { cn } from "@/lib/utils"
import { TaskKanban } from "@/components/tasks/task-kanban"
import type { Employee, PortalTask, TaskPriority, TasksListResponse } from "@/types/portal"

interface TasksPageContentProps {
  initial: TasksListResponse
  employees: Employee[]
  currentUserId: string
  initialFilters: {
    scope: string
    status: string
    priority: string
    q: string
  }
}

type ScopeTab = "all" | "mine" | "created" | "watching" | "overdue" | "important"

function formatDate(value: string | null): string {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function applyDuePreset(preset: "today" | "tomorrow" | "week"): string {
  const date = new Date()
  if (preset === "tomorrow") date.setDate(date.getDate() + 1)
  if (preset === "week") date.setDate(date.getDate() + 7)
  return toDateOnly(date)
}

export function TasksPageContent({
  initial,
  employees,
  currentUserId,
  initialFilters,
}: TasksPageContentProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [scope, setScope] = useState<ScopeTab>((initialFilters.scope as ScopeTab) || "all")
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || "all")
  const [priorityFilter, setPriorityFilter] = useState(initialFilters.priority || "all")
  const [search, setSearch] = useState(initialFilters.q)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [dueDate, setDueDate] = useState("")
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [watcherIds, setWatcherIds] = useState<string[]>([])
  const [selectedWatcherId, setSelectedWatcherId] = useState<string | null>(null)
  const [createFile, setCreateFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completeTask, setCompleteTask] = useState<PortalTask | null>(null)
  const [completionResult, setCompletionResult] = useState("")
  const [completeFile, setCompleteFile] = useState<File | null>(null)
  const [view, setView] = useState<"list" | "kanban">("list")

  const applyFilters = (next: {
    scope?: ScopeTab
    status?: string
    priority?: string
    q?: string
  }) => {
    const params = new URLSearchParams()
    const nextScope = next.scope ?? scope
    const nextStatus = next.status ?? statusFilter
    const nextPriority = next.priority ?? priorityFilter
    const nextQ = next.q ?? search
    if (nextScope && nextScope !== "all") params.set("scope", nextScope)
    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus)
    if (nextPriority && nextPriority !== "all") params.set("priority", nextPriority)
    if (nextQ.trim()) params.set("q", nextQ.trim())
    const qs = params.toString()
    startTransition(() => router.push(qs ? `/tasks?${qs}` : "/tasks"))
  }

  const tasks = useMemo(() => initial.items, [initial.items])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!title.trim()) {
      setError("Укажите название задачи")
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          assigneeId,
          watcherIds: watcherIds.length > 0 ? watcherIds : undefined,
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось создать задачу")
        return
      }
      const body = (await response.json()) as { item: PortalTask }
      if (!body.item?.id) {
        setError("Задача создана, но ответ сервера некорректный")
        return
      }
      if (createFile) {
        const formData = new FormData()
        formData.append("file", createFile)
        await fetch(`/api/tasks/${body.item.id}/attachments`, { method: "POST", body: formData })
      }
      router.push(`/tasks/${body.item.id}`)
      router.refresh()
    } catch {
      setError("Сетевая ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  const patchStatus = async (taskId: string, status: PortalTask["status"]) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    })
    startTransition(() => router.refresh())
  }

  const toggleImportant = async (task: PortalTask) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isImportant: !task.isImportant }),
    })
    startTransition(() => router.refresh())
  }

  const submitComplete = async () => {
    if (!completeTask || !completionResult.trim()) return
    const formData = new FormData()
    formData.append("completionResult", completionResult.trim())
    if (completeFile) formData.append("file", completeFile)
    const response = await fetch(`/api/tasks/${completeTask.id}/complete`, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? "Не удалось завершить задачу")
      return
    }
    setCompleteTask(null)
    setCompletionResult("")
    setCompleteFile(null)
    startTransition(() => router.refresh())
  }

  const deleteTask = async (taskId: string) => {
    if (!confirm("Удалить задачу?")) return
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
    startTransition(() => router.refresh())
  }

  const openTaskChat = async (taskId: string) => {
    const response = await fetch(`/api/tasks/${taskId}/chat`)
    if (!response.ok) {
      setError("Не удалось открыть чат задачи")
      return
    }
    const body = (await response.json()) as { channelId: string | null }
    if (!body.channelId) {
      setError("Чат задачи не создан")
      return
    }
    router.push(`/chat?channel=${body.channelId}`)
  }

  const tabs: { id: ScopeTab; label: string }[] = [
    { id: "all", label: "Все" },
    { id: "mine", label: "Мои" },
    { id: "created", label: "Поставленные мной" },
    { id: "watching", label: "Наблюдаю" },
    { id: "overdue", label: "Просроченные" },
    { id: "important", label: "Важные" },
  ]

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Задачи</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Список поручений: фильтры, сроки, файлы, чат задачи.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4 border-t pt-6">
          <h2 className="font-medium">Новая задача</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="task-title">Название *</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Подготовить отчёт"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="task-description">Описание</Label>
              <Textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Приоритет</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {TASK_PRIORITY_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Крайний срок</Label>
              <div className="mb-2 flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDueDate(applyDuePreset("today"))}
                >
                  Сегодня
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDueDate(applyDuePreset("tomorrow"))}
                >
                  Завтра
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDueDate(applyDuePreset("week"))}
                >
                  Через неделю
                </Button>
              </div>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Исполнитель</Label>
              <EmployeePicker employees={employees} value={assigneeId} onChange={setAssigneeId} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Наблюдатели</Label>
              <div className="mb-2 flex flex-wrap gap-2">
                {watcherIds.map((id) => {
                  const employee = employees.find((e) => e.userId === id)
                  return (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {employee?.name ?? id}
                      <button
                        type="button"
                        className="ml-1"
                        onClick={() => setWatcherIds((prev) => prev.filter((w) => w !== id))}
                      >
                        ×
                      </button>
                    </Badge>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <EmployeePicker
                  employees={employees.filter(
                    (e) => e.userId !== assigneeId && !watcherIds.includes(e.userId)
                  )}
                  value={selectedWatcherId}
                  onChange={setSelectedWatcherId}
                  placeholder="Добавить наблюдателя"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (selectedWatcherId && !watcherIds.includes(selectedWatcherId)) {
                      setWatcherIds((prev) => [...prev, selectedWatcherId])
                      setSelectedWatcherId(null)
                    }
                  }}
                >
                  Добавить
                </Button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Прикрепить файл (до 25 МБ)
              </Label>
              <Input type="file" onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={submitting || pending}>
            Поставить задачу
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="mb-4 space-y-3 border-b pb-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={scope === item.id ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setScope(item.id)
                  applyFilters({ scope: item.id })
                }}
              >
                {item.label}
              </Button>
            ))}
            <span className="ml-auto flex items-center gap-2 self-center text-sm text-muted-foreground">
              <Button
                type="button"
                size="sm"
                variant={view === "list" ? "default" : "outline"}
                onClick={() => setView("list")}
              >
                Список
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "kanban" ? "default" : "outline"}
                onClick={() => setView("kanban")}
              >
                Канбан
              </Button>
              <span>Всего: {initial.total}</span>
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters({ q: search })
              }}
              placeholder="Поиск по названию..."
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                applyFilters({ status: value })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(TASK_STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priorityFilter}
              onValueChange={(value) => {
                setPriorityFilter(value)
                applyFilters({ priority: value })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Приоритет" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все приоритеты</SelectItem>
                {TASK_PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {TASK_PRIORITY_LABEL[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={() => applyFilters({ q: search })}>
              Найти
            </Button>
          </div>
        </div>

        {view === "kanban" ? (
          <TaskKanban tasks={tasks} onStatusChange={(taskId, status) => patchStatus(taskId, status)} />
        ) : tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Задач нет</p>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => {
              const overdue = task.isOverdue ?? isTaskOverdue(task)
              const active = task.status !== "done" && task.status !== "cancelled"
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0",
                    overdue && "-mx-2 rounded-md bg-destructive/5 px-2"
                  )}
                >
                  <Button
                    type="button"
                    size="icon"
                    variant={task.isImportant ? "default" : "ghost"}
                    className={cn(
                      "shrink-0",
                      task.isImportant && "bg-orange-500 hover:bg-orange-600"
                    )}
                    onClick={() => void toggleImportant(task)}
                    title="Важная"
                  >
                    <Flame className="h-4 w-4" />
                  </Button>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="line-clamp-1 font-medium hover:underline"
                    >
                      {task.title}
                    </Link>
                    {task.description ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {task.description}
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Постановщик: {task.creatorName}</span>
                      {task.assigneeName ? <span>· Исполнитель: {task.assigneeName}</span> : null}
                      {overdue ? <Badge variant="destructive">Просрочена</Badge> : null}
                      {task.requiresAssignment || (task.protocolActionItemId && !task.assigneeId) ? (
                        <Badge variant="outline">Требует назначения</Badge>
                      ) : null}
                    </div>
                  </div>

                  <Badge variant={overdue ? "destructive" : "secondary"}>
                    {TASK_STATUS_LABEL[task.status]}
                  </Badge>
                  <span
                    className={cn(
                      "whitespace-nowrap text-sm",
                      overdue && "font-medium text-destructive"
                    )}
                  >
                    {formatDate(task.dueDate)}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {TASK_PRIORITY_LABEL[task.priority]}
                  </span>

                  <div className="flex flex-wrap gap-1">
                    {active && task.status === "new" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void patchStatus(task.id, "in_progress")}
                      >
                        <Play className="mr-1 h-3 w-3" />
                        Начать
                      </Button>
                    ) : null}
                    {active && task.status !== "new" ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setCompleteTask(task)
                          setCompletionResult("")
                        }}
                      >
                        Завершить
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Чат"
                      onClick={() => void openTaskChat(task.id)}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    {task.creatorId === currentUserId ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Удалить"
                        onClick={() => void deleteTask(task.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Dialog open={Boolean(completeTask)} onOpenChange={(open) => !open && setCompleteTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Завершить задачу</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Результат *</Label>
              <Textarea
                value={completionResult}
                onChange={(e) => setCompletionResult(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Файл результата</Label>
              <Input type="file" onChange={(e) => setCompleteFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCompleteTask(null)}>
              Отмена
            </Button>
            <Button type="button" onClick={() => void submitComplete()}>
              Завершить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
