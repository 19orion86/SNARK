'use client'

import {
  LayoutDashboard,
  Users,
  FileText,
  User,
  Building2,
  Calendar,
  HelpCircle,
  BookOpen,
  LogOut,
  ChevronRight,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  currentPage?: string
  onNavigate?: (page: string) => void
}

const menuItems = [
  {
    id: 'dashboard',
    label: 'Главная',
    icon: LayoutDashboard,
    description: 'Дашборд',
  },
  {
    id: 'employees',
    label: 'Сотрудники',
    icon: Users,
    description: 'Справочник',
  },
  {
    id: 'documents',
    label: 'Документы',
    icon: FileText,
    description: 'Нормативная база',
  },
  {
    id: 'profile',
    label: 'Мой профиль',
    icon: User,
    description: 'Личный кабинет',
  },
]

const secondaryItems = [
  { id: 'about', label: 'О компании', icon: Building2 },
  { id: 'calendar', label: 'Календарь', icon: Calendar },
  { id: 'library', label: 'Библиотека', icon: BookOpen },
  { id: 'support', label: 'Поддержка', icon: HelpCircle },
]

export function Sidebar({
  isOpen = false,
  onClose,
  currentPage = 'dashboard',
  onNavigate,
}: SidebarProps) {
  const handleNavigate = (id: string) => {
    console.log('[v0] Sidebar handleNavigate called with id:', id)
    console.log('[v0] onNavigate function exists:', !!onNavigate)
    if (onNavigate) {
      onNavigate(id)
    }
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 top-16 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-16 bottom-0 left-0 z-40 flex w-64 flex-col bg-sidebar transition-transform duration-300 ease-in-out',
          'md:static md:h-auto md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Mobile header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 md:hidden">
          <span className="text-lg font-bold text-sidebar-foreground">Меню</span>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-sidebar-foreground hover:bg-sidebar-accent/20"
            aria-label="Закрыть меню"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Основное
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-primary hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <div className="flex-1 truncate">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs opacity-60">{item.description}</div>
                </div>
                {isActive && <ChevronRight className="h-4 w-4 shrink-0" />}
              </button>
            )
          })}

          <div className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Дополнительно
          </div>
          {secondaryItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-primary hover:text-sidebar-foreground"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3">
          <button 
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-destructive/20 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span>Выход</span>
          </button>
        </div>
      </aside>
    </>
  )
}
