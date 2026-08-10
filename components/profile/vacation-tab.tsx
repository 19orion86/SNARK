"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Building2 } from "lucide-react"
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
import { cn } from "@/lib/utils"
import {
  VACATION_STATUS_LABEL,
  VACATION_TYPE_LABEL,
  formatVacationPeriod,
} from "@/lib/portal-data/vacations-ui"
import type { VacationBalance, VacationItem } from "@/types/portal"
import { VacationRequestSheet } from "./vacation-request-sheet"

interface VacationTabProps {
  presenceLabel: string
}

export function VacationTab({ presenceLabel }: VacationTabProps) {
  const [balance, setBalance] = useState<VacationBalance | null>(null)
  const [items, setItems] = useState<VacationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [balanceResponse, listResponse] = await Promise.all([
        fetch("/api/vacations/balance", { cache: "no-store" }),
        fetch("/api/vacations", { cache: "no-store" }),
      ])
      if (!balanceResponse.ok) throw new Error("Не удалось загрузить остаток дней")
      if (!listResponse.ok) throw new Error("Не удалось загрузить историю отпусков")
      const balanceData = (await balanceResponse.json()) as VacationBalance
      const listData = (await listResponse.json()) as { items: VacationItem[] }
      setBalance(balanceData)
      setItems(listData.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки данных об отпусках")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const today = new Date().toISOString().slice(0, 10)
  const nextVacation = items
    .filter((item) => item.status === "approved" && item.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]

  const handleCreated = (item: VacationItem) => {
    setItems((current) => [item, ...current])
    void loadData()
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Остаток дней</p>
          <p className="text-3xl font-bold text-card-foreground">
            {balance ? balance.remaining : "—"}
          </p>
          {balance && (
            <p className="mt-1 text-sm text-muted-foreground">
              Использовано: {balance.used} из {balance.annual}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Следующий отпуск</p>
          {nextVacation ? (
            <>
              <p className="text-sm font-medium text-card-foreground">
                {formatVacationPeriod(nextVacation.startDate, nextVacation.endDate)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {VACATION_TYPE_LABEL[nextVacation.type]}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-card-foreground">Не запланирован</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Статус</p>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4" /> {presenceLabel}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-card-foreground">История отпусков</h3>
        <div className="flex flex-wrap gap-2">
          <Link href="/vacations/calendar">
            <Button type="button" variant="outline">
              Календарь отпусков
            </Button>
          </Link>
          <Button
            type="button"
            className="bg-[#16223b] hover:bg-[#16223b]/90"
            onClick={() => setSheetOpen(true)}
          >
            Подать заявку
          </Button>
        </div>
      </div>

      <Card className="p-4">
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка истории отпусков…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">У вас пока нет заявок на отпуск.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Период</TableHead>
                <TableHead>Дней</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((vacation) => {
                const statusInfo = VACATION_STATUS_LABEL[vacation.status]
                return (
                  <TableRow key={vacation.id}>
                    <TableCell>
                      {formatVacationPeriod(vacation.startDate, vacation.endDate)}
                    </TableCell>
                    <TableCell>{vacation.daysTotal}</TableCell>
                    <TableCell>{VACATION_TYPE_LABEL[vacation.type]}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          statusInfo.classes
                        )}
                      >
                        {statusInfo.label}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <VacationRequestSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreated={handleCreated}
      />
    </div>
  )
}
