"use client"

import { useEffect, useState } from "react"
import { getSidebarItems } from "@/lib/navigation/sidebar-items"
import type { SidebarItem } from "@/types/portal"

export function useSidebarNavigation() {
  const [items, setItems] = useState<SidebarItem[]>(getSidebarItems)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const statsRes = await fetch("/api/tasks/stats").catch(() => null)
      if (!statsRes?.ok) return
      const stats = (await statsRes.json()) as { overdueCount?: number }
      const overdueCount = Number(stats.overdueCount ?? 0)
      if (mounted && overdueCount > 0) {
        setItems((prev) =>
          prev.map((item) => (item.id === "tasks" ? { ...item, badge: overdueCount } : item))
        )
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return { items }
}
