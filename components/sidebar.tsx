import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
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
    description: 'Основная панель',
  },
  {
    id: 'employees',
    label: 'Сотрудники',
    icon: Users,
    description: 'Справочник сотрудников',
  },
  {
    id: 'documents',
    label: 'Документы',
    icon: FileText,
    description: 'Корпоративные документы',
  },
  {
    id: 'profile',
    label: 'Мой профиль',
    icon: Settings,
    description: 'Личный кабинет',
  },
]

export function Sidebar({
  isOpen = true,
  onClose,
  currentPage = 'dashboard',
  onNavigate,
}: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar transition-transform duration-300 md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-6 py-4">
          <h2 className="font-heading text-lg font-bold text-sidebar-foreground">
            СНАРК
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-sidebar-accent/20 md:hidden"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate?.(item.id)
                  onClose?.()
                }}
                className={cn(
                  'w-full rounded-lg px-4 py-3 text-left transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/10'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs opacity-75">{item.description}</div>
                    </div>
                  </div>
                  {isActive && (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </button>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent/10 transition-colors">
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Выход</span>
          </button>
        </div>
      </aside>
    </>
  )
}
