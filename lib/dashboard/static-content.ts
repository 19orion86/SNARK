import type { QuickAction, ServiceCardItem } from "@/types/portal"

/** Быстрые действия на дашборде: статическая навигация, не данные БД. */
export const DASHBOARD_QUICK_ACTIONS: readonly QuickAction[] = [
  { label: "Создать заявку", icon: "HelpCircle", href: "/support" },
  { label: "Забронировать переговорную", icon: "DoorOpen", href: "/booking" },
  { label: "Новости компании", icon: "Newspaper", href: "/news" },
  { label: "Найти сотрудника", icon: "Users", href: "/contacts" },
  { label: "Нормативная база", icon: "FileText", href: "/documents" },
  { label: "Электронная библиотека", icon: "BookOpen", href: "/knowledge" },
]

/** Карточки сервисов на дашборде: статическая навигация, не данные БД. */
export const DASHBOARD_SERVICE_CARDS: readonly ServiceCardItem[] = [
  {
    title: "Личный кабинет",
    description: "Ваш профиль, задачи, отпуск, оценки",
    icon: "Users",
    color: "bg-secondary",
    href: "/profile",
  },
  {
    title: "Кадровые вопросы",
    description: "Всё о работе в СНАРК",
    icon: "FileText",
    color: "bg-accent",
    href: "/documents?category=hr",
  },
  {
    title: "Корп. культура",
    description: "Мероприятия, фото, жизнь компании",
    icon: "Calendar",
    color: "bg-success",
    href: "/news?category=company",
  },
  {
    title: "Нормативная база",
    description: "Политики, регламенты, инструкции",
    icon: "BookOpen",
    color: "bg-destructive",
    href: "/documents",
  },
]

export function getDashboardQuickActions(): QuickAction[] {
  return DASHBOARD_QUICK_ACTIONS.map((item) => ({ ...item }))
}

export function getDashboardServiceCards(): ServiceCardItem[] {
  return DASHBOARD_SERVICE_CARDS.map((item) => ({ ...item }))
}
