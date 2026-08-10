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
import {
  VACATION_TYPE_LABEL,
  formatVacationPeriod,
} from "@/lib/portal-data/vacations-ui"
import type { AdminVacationItem } from "@/types/portal"

interface VacationApprovalItem {
  id: string
  vacationId: string
  step: "manager" | "hr"
  status: "pending" | "approved" | "rejected"
  comment: string | null
}

interface AdminVacationsTableProps {
  initial: AdminVacationItem[]
  approvalsByVacation?: Record<string, VacationApprovalItem[]>
}

const STEP_LABEL: Record<string, string> = {
  manager: "Руководитель",
  hr: "HR",
}

const STATUS_LABEL: Record<string, string> = {
  pending: "ожидает",
  approved: "утверждено",
  rejected: "отклонено",
}

export function AdminVacationsTable({
  initial,
  approvalsByVacation = {},
}: AdminVacationsTableProps) {
  const router = useRouter()
  const [items, setItems] = useState<AdminVacationItem[]>(initial)
  const [approvals, setApprovals] = useState(approvalsByVacation)
  const [pending, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    setError(null)
    setActiveId(id)
    try {
      const comment =
        status === "rejected"
          ? typeof window !== "undefined"
            ? window.prompt("Комментарий к отказу (необязательно)") ?? undefined
            : undefined
          : undefined

      const response = await fetch(`/api/admin/vacations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, comment }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось обновить заявку")
        return
      }
      setItems((current) => current.filter((item) => item.id !== id))
      startTransition(() => {
        router.refresh()
      })
    } catch {
      setError("Сетевая ошибка при обновлении заявки")
    } finally {
      setActiveId(null)
    }
  }

  const handleStep = async (
    vacationId: string,
    step: "manager" | "hr",
    status: "approved" | "rejected"
  ) => {
    setError(null)
    setActiveId(`${vacationId}:${step}`)
    try {
      const comment =
        status === "rejected"
          ? typeof window !== "undefined"
            ? window.prompt("Комментарий к отказу (необязательно)") ?? undefined
            : undefined
          : undefined
      const response = await fetch(`/api/vacations/${vacationId}/approvals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step, status, comment }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось обновить шаг согласования")
        return
      }
      const body = (await response.json()) as { item: VacationApprovalItem }
      setApprovals((prev) => {
        const list = [...(prev[vacationId] ?? [])]
        const idx = list.findIndex((a) => a.step === step)
        if (idx >= 0) list[idx] = body.item
        else list.push(body.item)
        return { ...prev, [vacationId]: list }
      })
      if (status === "rejected" || body.item.status === "approved") {
        // if all done or rejected, may leave list — refresh
        startTransition(() => router.refresh())
      }
    } catch {
      setError("Сетевая ошибка при согласовании")
    } finally {
      setActiveId(null)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-card-foreground">Заявки на отпуск</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Согласуйте или отклоните поданные сотрудниками заявки на отпуск.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">На согласовании: {items.length}</span>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Нет заявок, ожидающих согласования.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead>Отдел</TableHead>
                <TableHead>Период</TableHead>
                <TableHead>Дней</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Согласование</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isLoading = (pending && activeId === item.id) || activeId === item.id
                const steps = approvals[item.id] ?? []
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.authorName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.authorDepartment ?? "Без отдела"}
                    </TableCell>
                    <TableCell>{formatVacationPeriod(item.startDate, item.endDate)}</TableCell>
                    <TableCell>{item.daysTotal}</TableCell>
                    <TableCell>{VACATION_TYPE_LABEL[item.type]}</TableCell>
                    <TableCell>
                      {steps.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Нет цепочки</span>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {steps.map((step) => (
                            <li key={step.id} className="flex flex-wrap items-center gap-2">
                              <span>
                                {STEP_LABEL[step.step] ?? step.step}:{" "}
                                {STATUS_LABEL[step.status] ?? step.status}
                              </span>
                              {step.status === "pending" ? (
                                <span className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[11px]"
                                    disabled={Boolean(activeId)}
                                    onClick={() => void handleStep(item.id, step.step, "approved")}
                                  >
                                    OK
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[11px] text-destructive"
                                    disabled={Boolean(activeId)}
                                    onClick={() => void handleStep(item.id, step.step, "rejected")}
                                  >
                                    Нет
                                  </Button>
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-600/90"
                          onClick={() => handleAction(item.id, "approved")}
                          disabled={isLoading}
                        >
                          {isLoading ? "..." : "Утвердить"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(item.id, "rejected")}
                          disabled={isLoading}
                        >
                          Отклонить
                        </Button>
                      </div>
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
