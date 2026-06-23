"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ticketCategoryLabel } from "@/lib/portal-data/ticket-categories"
import {
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
} from "@/lib/portal-data/tickets-ui"
import type { TicketCategoriesResponse, TicketsListResponse } from "@/types/portal"

interface AdminTicketsTableProps {
  initial: TicketsListResponse
  categories: TicketCategoriesResponse["items"]
  currentAdminId: string
}

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

export function AdminTicketsTable({ initial, categories, currentAdminId }: AdminTicketsTableProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onTakeToWork = async (ticketId: string) => {
    setError(null)
    setActiveId(ticketId)
    try {
      const response = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "in_progress", assigneeId: currentAdminId }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось обновить заявку")
        return
      }
      startTransition(() => {
        router.refresh()
      })
    } catch {
      setError("Сетевая ошибка при обновлении заявки")
    } finally {
      setActiveId(null)
    }
  }

  const tickets = initial.items

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-card-foreground">Заявки</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Все заявки портала. Возьмите задачу в работу, чтобы статус и ответственный обновились
            автоматически.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">Всего: {initial.total}</span>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {tickets.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Заявок пока нет.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Автор</TableHead>
                <TableHead>Тема</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Приоритет</TableHead>
                <TableHead>Исполнитель</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => {
                const statusMeta = TICKET_STATUS_LABEL[ticket.status]
                const isLoading = (pending && activeId === ticket.id) || activeId === ticket.id
                return (
                  <TableRow key={ticket.id}>
                    <TableCell>{ticket.authorName}</TableCell>
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
                      {ticket.assigneeName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(ticket.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {ticket.status === "new" ? (
                        <Button
                          size="sm"
                          onClick={() => onTakeToWork(ticket.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? "Берём..." : "Взять в работу"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}
