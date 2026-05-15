"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { User, Menu, LogOut } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { useAuth } from "@/hooks/use-auth"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      router.replace("/login")
      router.refresh()
      setIsLoggingOut(false)
    }
  }

  const fullName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "..."

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

          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="На главную — ПКФ Снарк"
          >
            <BrandLogo variant="on-dark" size="md" priority />
            <div className="hidden md:block">
              <p className="text-lg font-bold text-white">СНАРК</p>
              <p className="text-xs text-white/70">Корпоративный портал</p>
            </div>
          </Link>
        </div>

        {/* Right: User profile + logout */}
        <div className="flex items-center gap-1 md:gap-2">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
              <User className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <span className="hidden max-w-[12rem] truncate text-sm font-medium text-white md:block">
              {fullName}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            aria-label="Выйти из аккаунта"
            className="flex items-center gap-2 rounded-lg p-2 text-white/90 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden text-sm font-medium md:inline">
              {isLoggingOut ? "Выход..." : "Выйти"}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
