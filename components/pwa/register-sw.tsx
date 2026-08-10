"use client"

import { useEffect } from "react"

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore registration errors in unsupported environments
    })
  }, [])
  return null
}
