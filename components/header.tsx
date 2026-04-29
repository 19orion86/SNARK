import { Bell, Settings, User, LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="rounded-lg p-2 hover:bg-muted md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-heading text-xl font-bold text-primary">СНАРК</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="relative rounded-lg p-2 hover:bg-muted">
            <Bell className="h-5 w-5 text-foreground" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
          </button>
          
          <button className="rounded-lg p-2 hover:bg-muted">
            <Settings className="h-5 w-5 text-foreground" />
          </button>
          
          <div className="flex items-center gap-2 rounded-lg border border-border p-2 hover:bg-muted">
            <div className="h-8 w-8 rounded-full bg-secondary/20 flex items-center justify-center">
              <User className="h-4 w-4 text-secondary" />
            </div>
            <div className="hidden sm:block text-sm font-medium text-foreground">
              Профиль
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
