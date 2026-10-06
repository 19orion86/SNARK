/**
 * Типы виджетов дашборда.
 * Лежат вне route handler: Next.js разрешает экспортировать из `route.ts`
 * только HTTP-методы и конфиг сегмента, иначе `next build` / typecheck падают.
 */
export const WIDGET_TYPES = [
  "birthdays",
  "new_hires",
  "news",
  "my_tasks",
  "overdue",
  "unread_chats",
] as const

export type DashboardWidgetType = (typeof WIDGET_TYPES)[number]

export interface DashboardWidgetItem {
  id: string
  widgetType: DashboardWidgetType
  sortOrder: number
  enabled: boolean
  config: Record<string, unknown> | null
}
