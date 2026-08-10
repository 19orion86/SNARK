"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
export type DashboardWidgetType =
  | "birthdays"
  | "new_hires"
  | "news"
  | "my_tasks"
  | "overdue"
  | "unread_chats"

export interface WidgetConfigItem {
  widgetType: DashboardWidgetType
  sortOrder: number
  enabled: boolean
}

const WIDGET_LABELS: Record<DashboardWidgetType, string> = {
  birthdays: "Дни рождения",
  new_hires: "Новые сотрудники",
  news: "Новости",
  my_tasks: "Мои задачи",
  overdue: "Просроченные задачи",
  unread_chats: "Непрочитанные чаты",
}

interface DashboardWidgetsEditorProps {
  items: WidgetConfigItem[]
  onChange: (items: WidgetConfigItem[]) => void
  onSave: () => void
  saving?: boolean
}

export function DashboardWidgetsEditor({
  items,
  onChange,
  onSave,
  saving,
}: DashboardWidgetsEditorProps) {
  const [error, setError] = useState<string | null>(null)

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= items.length) return
    const next = [...items]
    const [row] = next.splice(index, 1)
    next.splice(nextIndex, 0, row)
    onChange(next.map((item, sortOrder) => ({ ...item, sortOrder })))
  }

  const toggle = (index: number, enabled: boolean) => {
    onChange(items.map((item, i) => (i === index ? { ...item, enabled } : item)))
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Настройка виджетов</h3>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => {
            setError(null)
            onSave()
          }}
        >
          {saving ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={item.widgetType}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <Label className="text-sm">{WIDGET_LABELS[item.widgetType]}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={item.enabled} onCheckedChange={(v) => toggle(index, v)} />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label="Выше"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
                aria-label="Ниже"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
