import type { TaskPriority, TaskStatus } from "@/types/portal"

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  review: "На проверке",
  done: "Выполнена",
  cancelled: "Отменена",
}

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
}

export const TASK_STATUS_OPTIONS: TaskStatus[] = [
  "new",
  "in_progress",
  "review",
  "done",
  "cancelled",
]

export const TASK_PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "critical"]
