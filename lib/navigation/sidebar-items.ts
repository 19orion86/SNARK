import type { SidebarItem } from "@/types/portal"

/**
 * Статический конфиг навигации портала.
 * Не зависит от репозитория данных, поэтому безопасен для client bundle.
 * Видимость пунктов по ролям проверяется в компоненте Sidebar (поле `roles`).
 */
export const SIDEBAR_ITEMS: readonly SidebarItem[] = [
  { id: "dashboard", label: "Главная", icon: "LayoutDashboard", description: "Дашборд", href: "/dashboard" },
  { id: "news", label: "Новости", icon: "Newspaper", description: "Лента новостей", href: "/news" },
  { id: "contacts", label: "Сотрудники", icon: "Users", description: "Справочник", href: "/contacts" },
  { id: "structure", label: "Структура", icon: "Building2", description: "Оргструктура", href: "/structure" },
  { id: "documents", label: "Документы", icon: "FileText", description: "Нормативная база", href: "/documents" },
  {
    id: "protocols",
    label: "Протоколы",
    icon: "Mic",
    description: "Аудио → текст → протокол",
    href: "/protocols",
  },
  { id: "tasks", label: "Задачи", icon: "CheckSquare", description: "Таск-менеджер", href: "/tasks" },
  { id: "crm", label: "CRM", icon: "Briefcase", description: "Сделки и воронка", href: "/crm" },
  { id: "chat", label: "Чат", icon: "MessageSquare", description: "Внутренняя переписка", href: "/chat" },
  { id: "profile", label: "Мой профиль", icon: "User", description: "Личный кабинет", href: "/profile" },
  {
    id: "admin",
    label: "Админ-панель",
    icon: "ShieldCheck",
    description: "Управление доступом",
    href: "/admin",
    roles: ["admin", "hr_manager"],
  },
]

export function getSidebarItems(): SidebarItem[] {
  return SIDEBAR_ITEMS.map((item) => ({ ...item }))
}
