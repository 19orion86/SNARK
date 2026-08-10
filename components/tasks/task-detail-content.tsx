"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"
import { Flame, Paperclip, Trash2 } from "lucide-react"
import { LiteMarkdownText } from "@/components/chat/message-body-with-mentions"
import { EmployeePicker } from "@/components/shared/employee-picker"
import { TaskInlineChat } from "@/components/tasks/task-inline-chat"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import type { Employee, TaskDetail, TaskPriority, TaskStatus } from "@/types/portal"

interface TaskDetailContentProps {
  task: TaskDetail
  employees: Employee[]
  currentUserId: string
}

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

export function TaskDetailContent({
  task: initial,
  employees,
  currentUserId,
}: TaskDetailContentProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const completeFileRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [task, setTask] = useState(initial)
  const [title, setTitle] = useState(initial.title)
  const [checklistTitle, setChecklistTitle] = useState("")
  const [commentBody, setCommentBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completionResult, setCompletionResult] = useState("")
  const [completeFile, setCompleteFile] = useState<File | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedWatcherId, setSelectedWatcherId] = useState<string | null>(null)
  const [selectedCoAssigneeId, setSelectedCoAssigneeId] = useState<string | null>(null)
  const [checklistAssigneeId, setChecklistAssigneeId] = useState<string | null>(null)
  const [subtaskTitle, setSubtaskTitle] = useState("")
  const [creatingSubtask, setCreatingSubtask] = useState(false)
  const [copilotPending, setCopilotPending] = useState(false)
  const [taskLinks, setTaskLinks] = useState<
    Array<{ id: string; entityType: string; entityId: string }>
  >([])

  const watchers = task.participants.filter((p) => p.role === "watcher")
  const coAssignees = task.participants.filter((p) => p.role === "co_assignee")
  const canDelete =
    task.creatorId === currentUserId || false // admin check on server

  const participantEmployees = useMemo(() => {
    const ids = new Set<string>()
    if (task.creatorId) ids.add(task.creatorId)
    if (task.assigneeId) ids.add(task.assigneeId)
    for (const participant of task.participants) ids.add(participant.userId)

    const fromProp = employees.filter((employee) => ids.has(employee.userId))
    const found = new Set(fromProp.map((employee) => employee.userId))
    const extras: Employee[] = []

    const pushExtra = (userId: string, name: string) => {
      if (found.has(userId)) return
      found.add(userId)
      extras.push({
        id: 0,
        userId,
        name,
        position: "",
        department: "",
        phone: "",
        email: "",
        office: "",
        status: "offline",
        avatar: "",
        isContractor: false,
        isNew: false,
      })
    }

    if (task.creatorId) pushExtra(task.creatorId, task.creatorName)
    if (task.assigneeId) pushExtra(task.assigneeId, task.assigneeName ?? task.assigneeId)
    for (const participant of task.participants) {
      pushExtra(participant.userId, participant.userName)
    }

    return [...fromProp, ...extras]
  }, [employees, task.assigneeId, task.assigneeName, task.creatorId, task.creatorName, task.participants])

  const refresh = () => startTransition(() => router.refresh())

  const loadLinks = async () => {
    const response = await fetch(`/api/tasks/${task.id}/links`)
    if (!response.ok) return
    const body = (await response.json()) as {
      items: Array<{ id: string; entityType: string; entityId: string }>
    }
    setTaskLinks(body.items)
  }

  const runCopilot = async (mode: "checklist" | "formulate" | "chat_summary") => {
    setCopilotPending(true)
    setError(null)
    try {
      const response = await fetch("/api/tasks/ai/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          taskId: task.id,
          title: task.title,
          description: task.description ?? "",
        }),
      })
      if (!response.ok) {
        setError("CoPilot временно недоступен")
        return
      }
      const body = (await response.json()) as {
        item: {
          title?: string
          description?: string
          checklist?: string[]
          summary?: string
        }
      }
      if (mode === "checklist" && body.item.checklist?.length) {
        for (const title of body.item.checklist) {
          await fetch(`/api/tasks/${task.id}/checklist`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title }),
          })
        }
        refresh()
      } else if (mode === "formulate") {
        if (body.item.title) {
          setTitle(body.item.title)
          await patchTask({
            title: body.item.title,
            description: body.item.description ?? task.description,
          })
        }
      } else if (mode === "chat_summary" && body.item.summary) {
        setCommentBody(`Саммари чата (CoPilot):\n${body.item.summary}`)
      }
    } finally {
      setCopilotPending(false)
    }
  }

  const applyTask = (next: TaskDetail) => {
    setTask(next)
    setTitle(next.title)
  }

  const patchTask = async (payload: Record<string, unknown>) => {
    setError(null)
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? "Не удалось обновить задачу")
      return null
    }
    const body = (await response.json()) as { item: TaskDetail }
    applyTask(body.item)
    refresh()
    return body.item
  }

  const startTask = () => void patchTask({ status: "in_progress" })

  const toggleImportant = () => void patchTask({ isImportant: !task.isImportant })

  const saveTitle = () => {
    if (title.trim() && title.trim() !== task.title) {
      void patchTask({ title: title.trim() })
    }
  }

  const addWatcher = async () => {
    if (!selectedWatcherId) return
    const response = await fetch(`/api/tasks/${task.id}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: selectedWatcherId, role: "watcher" }),
    })
    if (!response.ok) return
    const body = (await response.json()) as { item: TaskDetail }
    applyTask(body.item)
    setSelectedWatcherId(null)
  }

  const removeWatcher = async (userId: string) => {
    const response = await fetch(
      `/api/tasks/${task.id}/participants?userId=${userId}&role=watcher`,
      { method: "DELETE" }
    )
    if (!response.ok) return
    const body = (await response.json()) as { item: TaskDetail }
    applyTask(body.item)
  }

  const addCoAssignee = async () => {
    if (!selectedCoAssigneeId) return
    const response = await fetch(`/api/tasks/${task.id}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: selectedCoAssigneeId, role: "co_assignee" }),
    })
    if (!response.ok) return
    const body = (await response.json()) as { item: TaskDetail }
    applyTask(body.item)
    setSelectedCoAssigneeId(null)
  }

  const removeCoAssignee = async (userId: string) => {
    const response = await fetch(
      `/api/tasks/${task.id}/participants?userId=${userId}&role=co_assignee`,
      { method: "DELETE" }
    )
    if (!response.ok) return
    const body = (await response.json()) as { item: TaskDetail }
    applyTask(body.item)
  }

  const uploadAttachment = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch(`/api/tasks/${task.id}/attachments`, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      setError("Не удалось загрузить файл")
      return
    }
    refresh()
    const detailRes = await fetch(`/api/tasks/${task.id}`)
    if (detailRes.ok) {
      const body = (await detailRes.json()) as { item: TaskDetail }
      if (body.item) applyTask(body.item)
    }
  }

  const submitComplete = async () => {
    if (!completionResult.trim()) return
    const formData = new FormData()
    formData.append("completionResult", completionResult.trim())
    if (completeFile) formData.append("file", completeFile)
    const response = await fetch(`/api/tasks/${task.id}/complete`, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      setError("Не удалось завершить задачу")
      return
    }
    const body = (await response.json()) as { item: TaskDetail | null }
    if (!body.item) {
      setError("Задача завершена, но не удалось обновить карточку")
      return
    }
    applyTask(body.item)
    setCompleteOpen(false)
    setCompletionResult("")
    setCompleteFile(null)
  }

  const deleteTask = async () => {
    const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" })
    if (!response.ok) {
      setError("Не удалось удалить задачу")
      return
    }
    router.push("/tasks")
    router.refresh()
  }

  const addChecklistItem = async () => {
    if (!checklistTitle.trim()) return
    const response = await fetch(`/api/tasks/${task.id}/checklist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: checklistTitle.trim(),
        assigneeId: checklistAssigneeId,
      }),
    })
    if (!response.ok) return
    const body = (await response.json()) as { item: TaskDetail["checklist"][number] }
    setTask((prev) => ({ ...prev, checklist: [...prev.checklist, body.item] }))
    setChecklistTitle("")
    setChecklistAssigneeId(null)
  }

  const toggleChecklistItem = async (itemId: string, isDone: boolean) => {
    const response = await fetch(`/api/tasks/${task.id}/checklist/${itemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isDone }),
    })
    if (!response.ok) return
    const body = (await response.json()) as { item: TaskDetail["checklist"][number] }
    setTask((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) => (item.id === itemId ? body.item : item)),
    }))
  }

  const updateChecklistAssignee = async (itemId: string, assigneeId: string | null) => {
    const response = await fetch(`/api/tasks/${task.id}/checklist/${itemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assigneeId }),
    })
    if (!response.ok) return
    const body = (await response.json()) as { item: TaskDetail["checklist"][number] }
    setTask((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) => (item.id === itemId ? body.item : item)),
    }))
  }

  const addComment = async () => {
    if (!commentBody.trim()) return
    const response = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: commentBody.trim() }),
    })
    if (!response.ok) return
    const body = (await response.json()) as { item: TaskDetail["comments"][number] }
    setTask((prev) => ({ ...prev, comments: [...prev.comments, body.item] }))
    setCommentBody("")
  }

  const createSubtask = async () => {
    if (!subtaskTitle.trim() || task.parentTaskId) return
    setCreatingSubtask(true)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: subtaskTitle.trim(),
          parentTaskId: task.id,
          assigneeId: task.assigneeId,
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось создать подзадачу")
        return
      }
      setSubtaskTitle("")
      const detailRes = await fetch(`/api/tasks/${task.id}`)
      if (detailRes.ok) {
        const body = (await detailRes.json()) as { item: TaskDetail }
        if (body.item) applyTask(body.item)
      }
      refresh()
    } finally {
      setCreatingSubtask(false)
    }
  }

  const doneCount = task.checklist.filter((item) => item.isDone).length
  const isActive = task.status !== "done" && task.status !== "cancelled"
  const overdue = task.isOverdue ?? isTaskOverdue(task)
  const canHaveSubtasks = !task.parentTaskId

  const activityLabel = (item: NonNullable<TaskDetail["activity"]>[number]) => {
    if (item.action === "status_changed") {
      return `Статус: ${item.oldValue ?? "—"} → ${item.newValue ?? "—"}`
    }
    if (item.action === "assignee_changed") return "Изменён исполнитель"
    if (item.action === "due_date_changed") {
      return `Срок: ${item.oldValue ?? "—"} → ${item.newValue ?? "—"}`
    }
    return item.action
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/tasks" className="text-sm text-muted-foreground hover:underline">
            ← К списку задач
          </Link>
          <div className="mt-2 flex items-start gap-2">
            <Button
              type="button"
              size="icon"
              variant={task.isImportant ? "default" : "outline"}
              className={cn(task.isImportant && "bg-orange-500 hover:bg-orange-600")}
              title="Важная задача"
              onClick={toggleImportant}
            >
              <Flame className="h-4 w-4" />
            </Button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              className="text-xl font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{TASK_STATUS_LABEL[task.status]}</Badge>
            <Badge variant="outline">{TASK_PRIORITY_LABEL[task.priority]}</Badge>
            {task.isImportant ? <Badge className="bg-orange-500">Важная</Badge> : null}
            {overdue ? <Badge variant="destructive">Просрочена</Badge> : null}
            {task.requiresAssignment || (task.protocolActionItemId && !task.assigneeId) ? (
              <Badge variant="outline">Требует назначения</Badge>
            ) : null}
            {task.parentTaskId ? (
              <Badge variant="outline">
                <Link href={`/tasks/${task.parentTaskId}`} className="hover:underline">
                  Подзадача
                </Link>
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isActive && task.status === "new" ? (
            <Button onClick={startTask}>Начать</Button>
          ) : null}
          {isActive && task.status !== "new" ? (
            <Button onClick={() => setCompleteOpen(true)}>Завершить</Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="mr-2 h-4 w-4" />
            Файл
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={copilotPending}
            onClick={() => void runCopilot("checklist")}
          >
            CoPilot: чек-лист
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={copilotPending}
            onClick={() => void runCopilot("chat_summary")}
          >
            CoPilot: саммари
          </Button>
          <Button type="button" variant="destructive" size="icon" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void uploadAttachment(file)
          e.target.value = ""
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden p-6 space-y-4">
            <h2 className="text-lg font-semibold">Описание</h2>
            <Textarea
              defaultValue={task.description ?? ""}
              rows={4}
              placeholder="Описание задачи..."
              onBlur={(event) => {
                const value = event.target.value.trim()
                if (value !== (task.description ?? "")) {
                  void patchTask({ description: value || null })
                }
              }}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-due-detail">Крайний срок</Label>
                <Input
                  id="task-due-detail"
                  type="date"
                  defaultValue={task.dueDate ?? ""}
                  onBlur={(event) => {
                    const value = event.target.value || null
                    if (value !== task.dueDate) void patchTask({ dueDate: value })
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Приоритет</Label>
                <Select
                  value={task.priority}
                  onValueChange={(value) => void patchTask({ priority: value as TaskPriority })}
                >
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
            </div>
          </Card>

          <Card className="overflow-hidden p-6 space-y-4">
            <h2 className="text-lg font-semibold">Участники</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <Label className="text-muted-foreground">Постановщик</Label>
                <p className="break-words font-medium">{task.creatorName}</p>
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Исполнитель</Label>
                <EmployeePicker
                  employees={employees}
                  value={task.assigneeId}
                  onChange={(value) => void patchTask({ assigneeId: value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Соисполнители</Label>
              <div className="flex flex-wrap gap-2">
                {coAssignees.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1">
                    {c.userName}
                    <button
                      type="button"
                      className="ml-1"
                      onClick={() => void removeCoAssignee(c.userId)}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                {coAssignees.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Не назначены</span>
                ) : null}
              </div>
              <div className="flex min-w-0 gap-2">
                <EmployeePicker
                  employees={employees.filter(
                    (e) =>
                      e.userId !== task.creatorId &&
                      e.userId !== task.assigneeId &&
                      !coAssignees.some((c) => c.userId === e.userId) &&
                      !watchers.some((w) => w.userId === e.userId)
                  )}
                  value={selectedCoAssigneeId}
                  onChange={setSelectedCoAssigneeId}
                  placeholder="Добавить соисполнителя"
                />
                <Button type="button" variant="outline" className="shrink-0" onClick={() => void addCoAssignee()}>
                  Добавить
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Наблюдатели</Label>
              <div className="flex flex-wrap gap-2">
                {watchers.map((w) => (
                  <Badge key={w.id} variant="secondary" className="gap-1">
                    {w.userName}
                    <button type="button" className="ml-1" onClick={() => void removeWatcher(w.userId)}>
                      ×
                    </button>
                  </Badge>
                ))}
                {watchers.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Не назначены</span>
                ) : null}
              </div>
              <div className="flex min-w-0 gap-2">
                <EmployeePicker
                  employees={employees.filter(
                    (e) =>
                      e.userId !== task.creatorId &&
                      e.userId !== task.assigneeId &&
                      !watchers.some((w) => w.userId === e.userId) &&
                      !coAssignees.some((c) => c.userId === e.userId)
                  )}
                  value={selectedWatcherId}
                  onChange={setSelectedWatcherId}
                  placeholder="Добавить наблюдателя"
                />
                <Button type="button" variant="outline" className="shrink-0" onClick={() => void addWatcher()}>
                  Добавить
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Вложения</h2>
            {task.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Файлов пока нет</p>
            ) : (
              <ul className="space-y-2">
                {task.attachments.map((file) => (
                  <li key={file.id}>
                    <a
                      href={`/api/tasks/${task.id}/attachments/${file.id}/download`}
                      className="text-sm text-primary hover:underline"
                    >
                      {file.fileName}
                      {file.attachmentType === "completion" ? " (результат)" : ""}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canHaveSubtasks ? (
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">Подзадачи</h2>
              {(task.subtasks ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Подзадач пока нет</p>
              ) : (
                <ul className="space-y-2">
                  {(task.subtasks ?? []).map((sub) => (
                    <li key={sub.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                      <Link href={`/tasks/${sub.id}`} className="text-sm font-medium hover:underline">
                        {sub.title}
                      </Link>
                      <div className="flex items-center gap-2">
                        {(sub.isOverdue ?? isTaskOverdue(sub)) ? (
                          <Badge variant="destructive">Просрочена</Badge>
                        ) : null}
                        <Badge variant="secondary">{TASK_STATUS_LABEL[sub.status]}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  value={subtaskTitle}
                  onChange={(event) => setSubtaskTitle(event.target.value)}
                  placeholder="Название подзадачи"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={creatingSubtask || !subtaskTitle.trim()}
                  onClick={() => void createSubtask()}
                >
                  Добавить
                </Button>
              </div>
            </Card>
          ) : null}

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Связи</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => void loadLinks()}>
                Обновить
              </Button>
            </div>
            {taskLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Связей пока нет. Нажмите «Обновить», чтобы загрузить.
              </p>
            ) : (
              <ul className="space-y-2">
                {taskLinks.map((link) => (
                  <li key={link.id} className="text-sm">
                    <Badge variant="outline" className="mr-2">
                      {link.entityType}
                    </Badge>
                    {link.entityType === "ticket" ? (
                      <Link href="/support" className="text-primary hover:underline">
                        {link.entityId}
                      </Link>
                    ) : link.entityType === "chat_message" ? (
                      <span className="text-muted-foreground">{link.entityId}</span>
                    ) : (
                      <span>{link.entityId}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">История</h2>
            {(task.activity ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет изменений статуса, исполнителя или срока</p>
            ) : (
              <ul className="space-y-2">
                {(task.activity ?? []).map((item) => (
                  <li key={item.id} className="rounded-md border p-3 text-sm">
                    <div className="text-xs text-muted-foreground">
                      {item.actorName ?? "Система"} · {formatDate(item.createdAt)}
                    </div>
                    <p className="mt-1">{activityLabel(item)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {task.status === "done" && task.completionResult ? (
            <Card className="p-6 space-y-2">
              <h2 className="text-lg font-semibold">Результат</h2>
              <LiteMarkdownText text={task.completionResult} />
            </Card>
          ) : null}

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Чек-лист</h2>
              {task.checklist.length > 0 ? (
                <span className="text-sm text-muted-foreground">
                  {doneCount}/{task.checklist.length}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              {task.checklist.map((item) => (
                <div key={item.id} className="space-y-2 rounded-md border p-3">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={item.isDone}
                      onCheckedChange={(checked) =>
                        void toggleChecklistItem(item.id, checked === true)
                      }
                    />
                    <span className={item.isDone ? "line-through text-muted-foreground" : ""}>
                      {item.title}
                    </span>
                    {item.assigneeName ? (
                      <Badge variant="outline" className="ml-auto shrink-0">
                        {item.assigneeName}
                      </Badge>
                    ) : null}
                  </label>
                  <div className="pl-7">
                    <Label className="mb-1 text-xs text-muted-foreground">
                      Ответственный за пункт
                    </Label>
                    <EmployeePicker
                      employees={participantEmployees}
                      value={item.assigneeId}
                      onChange={(value) => void updateChecklistAssignee(item.id, value)}
                      placeholder="Ответственный за пункт"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Input
                value={checklistTitle}
                onChange={(event) => setChecklistTitle(event.target.value)}
                placeholder="Новый пункт"
              />
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Label className="mb-1 text-xs text-muted-foreground">
                    Ответственный за пункт
                  </Label>
                  <EmployeePicker
                    employees={participantEmployees}
                    value={checklistAssigneeId}
                    onChange={setChecklistAssigneeId}
                    placeholder="Ответственный за пункт"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5"
                  onClick={() => void addChecklistItem()}
                >
                  Добавить
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Комментарии</h2>
            <div className="space-y-3">
              {task.comments.map((comment) => (
                <div key={comment.id} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">
                    {comment.authorName} · {formatDate(comment.createdAt)}
                  </div>
                  <LiteMarkdownText text={comment.body} className="mt-1" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                rows={2}
                placeholder="Комментарий..."
              />
              <Button type="button" onClick={() => void addComment()}>
                Отправить
              </Button>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Чат задачи</h2>
            <TaskInlineChat taskId={task.id} currentUserId={currentUserId} />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="p-6 space-y-3 text-sm">
            <h2 className="text-lg font-semibold">Сведения</h2>
            <div>
              <span className="text-muted-foreground">Статус:</span> {TASK_STATUS_LABEL[task.status]}
            </div>
            <div className={cn(overdue && "font-medium text-destructive")}>
              <span className="text-muted-foreground">Срок:</span> {formatDate(task.dueDate)}
              {overdue ? " · просрочена" : ""}
            </div>
            <div>
              <span className="text-muted-foreground">Создана:</span> {formatDate(task.createdAt)}
            </div>
            {task.completedAt ? (
              <div>
                <span className="text-muted-foreground">Завершена:</span>{" "}
                {formatDate(task.completedAt)}
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Завершение задачи</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="completion-result">Результат выполнения *</Label>
              <Textarea
                id="completion-result"
                value={completionResult}
                onChange={(e) => setCompletionResult(e.target.value)}
                rows={4}
                placeholder="Опишите результат..."
              />
            </div>
            <div className="space-y-2">
              <Label>Файл результата (необязательно)</Label>
              <Input
                ref={completeFileRef}
                type="file"
                onChange={(e) => setCompleteFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void submitComplete()} disabled={!completionResult.trim()}>
              Завершить задачу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить задачу?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Задача «{task.title}» будет удалена без возможности восстановления.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={() => void deleteTask()}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {pending ? <p className="text-sm text-muted-foreground">Обновление...</p> : null}
    </div>
  )
}
