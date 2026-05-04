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
  Newspaper,
  ShieldCheck,
  LogOut,
  ChevronRight,
  X,
} from 'lucide-react'
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { UserRole } from "@/types/auth"
import type { SidebarItem } from "@/types/portal"
import { cn } from '@/lib/utils'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  role?: UserRole | null
  items: SidebarItem[]
}

const secondaryItems = [
  { id: 'about', label: 'О компании', icon: Building2 },
  { id: 'calendar', label: 'Календарь', icon: Calendar },
  { id: 'library', label: 'Библиотека', icon: BookOpen },
  { id: 'support', label: 'Поддержка', icon: HelpCircle },
]

const iconMap = {
  LayoutDashboard,
  Users,
  FileText,
  User,
  ShieldCheck,
  Building2,
  Calendar,
  HelpCircle,
  BookOpen,
  Newspaper,
} as const

function getIcon(iconName: SidebarItem["icon"]) {
  return iconMap[iconName as keyof typeof iconMap] ?? LayoutDashboard
}

export function Sidebar({
  isOpen = false,
  onClose,
  role,
  items,
}: SidebarProps) {
  const pathname = usePathname()
  const menuItems = items.filter((item) => !item.roles || (role ? item.roles.includes(role) : false))

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
            const Icon = getIcon(item.icon)
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
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
              </Link>
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
                onClick={onClose}
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
