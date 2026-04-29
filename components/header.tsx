import { Bell, Search, User, Menu, ChevronDown } from 'lucide-react'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 h-16 bg-primary">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        {/* Left: Logo and mobile menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-lg p-2 text-primary-foreground hover:bg-secondary md:hidden"
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          {/* Logo placeholder - will be replaced with actual logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <span className="text-lg font-bold text-white">С</span>
            </div>
            <div className="hidden md:block">
              <h1 className="text-lg font-bold text-white">СНАРК</h1>
              <p className="text-xs text-white/70">Корпоративный портал</p>
            </div>
          </div>
        </div>
        
        {/* Center: Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          {['О компании', 'Сотрудники', 'Документы', 'Сервисы', 'Корп. культура'].map((item) => (
            <button
              key={item}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            >
              {item}
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>
          ))}
        </nav>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Search */}
          <button 
            className="rounded-lg p-2 text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Поиск"
          >
            <Search className="h-5 w-5" />
          </button>
          
          {/* Notifications */}
          <button 
            className="relative rounded-lg p-2 text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Уведомления"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              3
            </span>
          </button>
          
          {/* User profile */}
          <button className="flex items-center gap-2 rounded-lg p-1.5 text-white transition-colors hover:bg-white/10 md:px-3 md:py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium">Иван Петров</p>
              <p className="text-xs text-white/70">Руководитель проекта</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 opacity-70 md:block" />
          </button>
        </div>
      </div>
    </header>
  )
}
