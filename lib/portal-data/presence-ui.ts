import type { Employee } from "@/types/portal"

export type EmployeePresenceStatus = Employee["status"]

export function employeeStatusLabel(status: EmployeePresenceStatus): string {
  if (status === "online") return "В офисе"
  if (status === "away") return "В отпуске"
  return "На удалёнке"
}

export function employeeStatusDotColor(status: EmployeePresenceStatus): string {
  if (status === "online") return "bg-success"
  if (status === "away") return "bg-accent"
  return "bg-primary"
}

export function employeeStatusBadgeClasses(status: EmployeePresenceStatus): string {
  if (status === "online") return "bg-success/15 text-success"
  if (status === "away") return "bg-accent/15 text-accent"
  return "bg-primary/15 text-primary"
}
