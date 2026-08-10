"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface LeaveItem {
  userName: string
  departmentId: string | null
  startDate: string
  endDate: string
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`
}

function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function formatTitle(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function inRange(dayKey: string, start: string, end: string): boolean {
  return dayKey >= start && dayKey <= end
}

export function LeaveCalendar() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [items, setItems] = useState<LeaveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/vacations/calendar?month=${monthKey(year, month)}`)
        if (!response.ok) throw new Error("Не удалось загрузить")
        const body = (await response.json()) as { items: LeaveItem[] }
        if (mounted) setItems(body.items ?? [])
      } catch {
        if (mounted) setError("Не удалось загрузить календарь отпусков")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [year, month])

  const cells = useMemo(() => {
    const total = new Date(year, month + 1, 0).getDate()
    const offset = mondayIndex(new Date(year, month, 1))
    const result: Array<{ day: number | null; key: string | null }> = []
    for (let i = 0; i < offset; i++) result.push({ day: null, key: null })
    for (let day = 1; day <= total; day++) {
      const key = `${monthKey(year, month)}-${String(day).padStart(2, "0")}`
      result.push({ day, key })
    }
    while (result.length % 7 !== 0) result.push({ day: null, key: null })
    return result
  }, [year, month])

  const changeMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Календарь отпусков</h1>
          <p className="mt-1 text-sm text-muted-foreground">Утверждённые отпуска сотрудников</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="icon" variant="outline" onClick={() => changeMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {formatTitle(year, month)}
          </span>
          <Button type="button" size="icon" variant="outline" onClick={() => changeMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p> : null}

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell.day || !cell.key) {
            return <div key={`e-${index}`} className="min-h-[96px] rounded-md bg-muted/20" />
          }
          const dayItems = items.filter((item) => inRange(cell.key!, item.startDate, item.endDate))
          return (
            <div key={cell.key} className="flex min-h-[96px] flex-col rounded-md border p-1.5">
              <span className="mb-1 text-xs font-semibold text-muted-foreground">{cell.day}</span>
              <div className="space-y-0.5 overflow-hidden">
                {dayItems.slice(0, 3).map((item, i) => (
                  <div
                    key={`${item.userName}-${i}`}
                    className={cn(
                      "truncate rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-800"
                    )}
                    title={`${item.userName}: ${item.startDate} — ${item.endDate}`}
                  >
                    {item.userName}
                  </div>
                ))}
                {dayItems.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">+{dayItems.length - 3}</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
