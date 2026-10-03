import type { ProfileTab } from "@/types/portal"

/** Вкладки личного кабинета: статический конфиг UI. */
export const PROFILE_TABS: readonly ProfileTab[] = [
  { id: "my_profile", label: "Мой профиль", icon: "User" },
  { id: "my_department", label: "Моё подразделение", icon: "Building2" },
  { id: "documents", label: "Документы", icon: "FileText" },
  { id: "vacation", label: "Отпуск", icon: "Calendar" },
]

export function getProfileTabs(): ProfileTab[] {
  return PROFILE_TABS.map((tab) => ({ ...tab }))
}

/** Подписи для незаполненных полей профиля (вместо подстановки mock-данных). */
export const PROFILE_PLACEHOLDERS = {
  position: "Сотрудник",
  department: "Без отдела",
} as const
