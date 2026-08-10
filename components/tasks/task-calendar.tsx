"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PortalTask } from "@/types/portal"

interface TaskCalendarProps {
  tasks: PortalTask[]
  onMonthChange?: (year: number, month: number) => void
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Monday-based weekday index 0..6 */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function dateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0")
  const d = String(day).padStart(2, "0")
  return `${year}-${m}-${d}`
}

function formatMonthTitle(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function TaskCalendar({ tasks, onMonthChange }: TaskCalendarProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const changeMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
    onMonthChange?.(next.getFullYear(), next.getMonth())
  }

  const tasksByDay = useMemo(() => {
    const map = new Map<string, PortalTask[]>()
    for (const task of tasks) {
      if (!task.dueDate) continue
      const key = task.dueDate.slice(0, 10)
      const list = map.get(key) ?? []
      list.push(task)
      map.set(key, list)
    }
    return map
  }, [tasks])

  const cells = useMemo(() => {
    const total = daysInMonth(year, month)
    const offset = mondayIndex(startOfMonth(year, month))
    const result: Array<{ day: number | null; key: string | null }> = []
    for (let i = 0; i < offset; i++) result.push({ day: null, key: null })
    for (let day = 1; day <= total; day++) {
      result.push({ day, key: dateKey(year, month, day) })
    }
    while (result.length % 7 !== 0) result.push({ day: null, key: null })
    return result
  }, [year, month])

  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate())

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" size="icon" variant="outline" onClick={() => changeMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-base font-semibold">{formatMonthTitle(year, month)}</h3>
        <Button type="button" size="icon" variant="outline" onClick={() => changeMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell.day || !cell.key) {
            return <div key={`empty-${index}`} className="min-h-[88px] rounded-md bg-muted/20" />
          }
          const dayTasks = tasksByDay.get(cell.key) ?? []
          const isToday = cell.key === todayKey
          return (
            <div
              key={cell.key}
              className={cn(
                "flex min-h-[88px] flex-col rounded-md border p-1.5",
                isToday && "border-primary bg-primary/5"
              )}
            >
              <Link
                href={dayTasks[0] ? `/tasks/${dayTasks[0].id}` : "/tasks"}
                className={cn(
                  "mb-1 text-xs font-semibold hover:underline",
                  isToday ? "text-primary" : "text-muted-foreground"
                )}
              >
                {cell.day}
              </Link>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {dayTasks.slice(0, 3).map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="truncate rounded bg-muted px-1 py-0.5 text-[10px] leading-tight hover:bg-muted/80"
                    title={task.title}
                  >
                    {task.title}
                  </Link>
                ))}
                {dayTasks.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3}</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
