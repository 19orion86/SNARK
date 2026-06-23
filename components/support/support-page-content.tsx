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

  const tickets: Ticket[] = initial.items

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => {
                  const statusMeta = TICKET_STATUS_LABEL[ticket.status]
                  return (
                    <TableRow key={ticket.id}>
                      <TableCell className="max-w-[320px] whitespace-normal font-medium">
                        {ticket.subject}
                      </TableCell>
                      <TableCell>{ticketCategoryLabel(ticket.category, categories)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.classes}`}
                        >
                          {statusMeta.label}
                        </span>
                      </TableCell>
                      <TableCell>{TICKET_PRIORITY_LABEL[ticket.priority]}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(ticket.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
