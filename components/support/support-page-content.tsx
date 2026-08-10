"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ticketCategoryLabel } from "@/lib/portal-data/ticket-categories"
import {
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
} from "@/lib/portal-data/tickets-ui"
import type {
  Ticket,
  TicketCategory,
  TicketCategoryItem,
  TicketPriority,
  TicketsListResponse,
} from "@/types/portal"

interface SupportPageContentProps {
  initial: TicketsListResponse
  categories: TicketCategoryItem[]
  defaultCategory?: TicketCategory
}

interface TicketComment {
  id: string
  authorName: string
  body: string
  createdAt: string
}

const PRIORITY_OPTIONS: TicketPriority[] = ["low", "medium", "high"]

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function SupportPageContent({ initial, categories, defaultCategory }: SupportPageContentProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const firstCategory = categories[0]?.slug ?? "it"
  const [category, setCategory] = useState<TicketCategory>(defaultCategory ?? firstCategory)
  const [priority, setPriority] = useState<TicketPriority>("medium")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [commentBody, setCommentBody] = useState("")
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  const tickets: Ticket[] = initial.items
  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!subject.trim()) {
      setError("Укажите тему заявки")
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          description: description.trim() ? description.trim() : undefined,
          priority,
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось отправить заявку")
        return
      }
      setSubject("")
      setDescription("")
      setCategory("it")
      setPriority("medium")
      startTransition(() => {
        router.refresh()
      })
    } catch {
      setError("Сетевая ошибка при отправке заявки")
    } finally {
      setSubmitting(false)
    }
  }

  const openTicket = async (ticketId: string) => {
    setSelectedTicketId(ticketId)
    setCommentsLoading(true)
    setCommentBody("")
    try {
      const response = await fetch(`/api/tickets/${ticketId}/comments`)
      if (response.ok) {
        const body = (await response.json()) as { items: TicketComment[] }
        setComments(body.items ?? [])
      } else {
        setComments([])
      }
    } catch {
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }

  const submitComment = async () => {
    if (!selectedTicketId || !commentBody.trim()) return
    setActionBusy(true)
    try {
      const response = await fetch(`/api/tickets/${selectedTicketId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: commentBody.trim() }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось добавить комментарий")
        return
      }
      const body = (await response.json()) as { item: TicketComment }
      setComments((prev) => [...prev, body.item])
      setCommentBody("")
    } catch {
      setError("Сетевая ошибка")
    } finally {
      setActionBusy(false)
    }
  }

  const createTaskFromTicket = async (ticketId: string) => {
    setActionBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/tasks/from-ticket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketId }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось создать задачу")
        return
      }
      const body = (await response.json()) as { item: { id: string } | null }
      if (body.item?.id) {
        router.push(`/tasks/${body.item.id}`)
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError("Сетевая ошибка при создании задачи")
    } finally {
      setActionBusy(false)
    }
  }

  const refreshing = pending

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold text-card-foreground">Поддержка</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Оформите заявку — ответственный специалист возьмёт её в работу. Мы постараемся вернуться с
          решением как можно быстрее.
        </p>

        <form onSubmit={onSubmit} className="mt-6 max-w-2xl space-y-4" aria-busy={submitting}>
          <div className="space-y-2">
            <Label htmlFor="ticket-category">Категория</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as TicketCategory)}>
              <SelectTrigger id="ticket-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                  {categories.map((value) => (
                    <SelectItem key={value.slug} value={value.slug}>
                      {value.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-priority">Приоритет</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as TicketPriority)}>
              <SelectTrigger id="ticket-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {TICKET_PRIORITY_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-subject">Тема</Label>
            <Input
              id="ticket-subject"
              value={subject}
              maxLength={200}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Например: «Не работает принтер на 3 этаже»"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-description">Описание</Label>
            <Textarea
              id="ticket-description"
              value={description}
              maxLength={5000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Опишите подробности: что случилось, какие шаги вы уже сделали"
              rows={4}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || refreshing}>
              {submitting ? "Отправляем..." : "Отправить заявку"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-card-foreground">Мои заявки</h2>
          <span className="text-sm text-muted-foreground">Всего: {initial.total}</span>
        </div>

        {tickets.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Пока нет заявок. Заполните форму выше — заявка появится в этом списке.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тема</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Приоритет</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => {
                  const statusMeta = TICKET_STATUS_LABEL[ticket.status]
                  return (
                    <TableRow
                      key={ticket.id}
                      className={selectedTicketId === ticket.id ? "bg-muted/40" : undefined}
                    >
                      <TableCell className="max-w-[280px] whitespace-normal font-medium">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => void openTicket(ticket.id)}
                        >
                          {ticket.subject}
                        </button>
                      </TableCell>
                      <TableCell>{ticketCategoryLabel(ticket.category, categories)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.classes}`}
                          >
                            {statusMeta.label}
                          </span>
                          {ticket.slaBreached ? (
                            <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                              SLA
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{TICKET_PRIORITY_LABEL[ticket.priority]}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(ticket.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionBusy}
                          onClick={() => void createTaskFromTicket(ticket.id)}
                        >
                          Создать задачу
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {selectedTicket ? (
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">{selectedTicket.subject}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedTicket.description || "Без описания"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={actionBusy}
              onClick={() => void createTaskFromTicket(selectedTicket.id)}
            >
              Создать задачу
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium">Комментарии</h3>
            {commentsLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет комментариев.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-md border p-3">
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>{comment.authorName}</span>
                      <span>{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Добавить комментарий..."
                rows={3}
              />
              <Button
                type="button"
                size="sm"
                disabled={actionBusy || !commentBody.trim()}
                onClick={() => void submitComment()}
              >
                Отправить
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
