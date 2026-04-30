"use client"

import { useCallback, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"

const pageToPath: Record<string, string> = {
  dashboard: "/dashboard",
  employees: "/dashboard",
  documents: "/dashboard",
  profile: "/dashboard",
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const currentPage = useMemo(() => {
    if (pathname.startsWith("/dashboard")) return "dashboard"
    if (pathname.startsWith("/admin")) return "dashboard"
    return "dashboard"
  }, [pathname])

  const handleNavigate = useCallback(
    (page: string) => {
      setSidebarOpen(false)
      const nextPath = pageToPath[page]
      if (nextPath) {
        router.push(nextPath)
      }
    },
    [router]
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header onMenuClick={() => setSidebarOpen((prev) => !prev)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentPage={currentPage}
          onNavigate={handleNavigate}
        />
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
