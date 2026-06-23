import type { TicketPriority, TicketStatus } from "@/types/portal"

export const TICKET_STATUS_LABEL: Record<TicketStatus, { label: string; classes: string }> = {
  new: { label: "Новая", classes: "bg-primary/15 text-primary" },
  in_progress: { label: "В работе", classes: "bg-accent/15 text-accent-foreground" },
  resolved: { label: "Решена", classes: "bg-emerald-500/15 text-emerald-700" },
  closed: { label: "Закрыта", classes: "bg-muted text-muted-foreground" },
}

export const TICKET_CATEGORY_LABEL: Record<string, string> = {
  it: "ИТ-поддержка",
  aho: "АХО",
  hr: "HR",
  other: "Другое",
}

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
}
