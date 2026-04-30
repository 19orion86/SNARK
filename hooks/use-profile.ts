"use client"

import { useEffect, useState } from "react"
import type { CurrentUserResponse, ProfileData, ProfileUpdatePayload } from "@/types/portal"

export function useProfile() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/users/me", { method: "GET" })
      if (!response.ok) {
        throw new Error("API profile request failed")
      }
      const result = (await response.json()) as CurrentUserResponse
      setData(result.profile)
    } catch {
      setError("Не удалось загрузить профиль")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refetch()
  }, [])

  const update = async (payload: ProfileUpdatePayload): Promise<boolean> => {
    setError(null)
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error("API profile update failed")
      }
      const result = (await response.json()) as CurrentUserResponse
      setData(result.profile)
      return true
    } catch {
      setError("Не удалось обновить профиль")
      return false
    }
  }

  return { data, isLoading, error, refetch, update }
}
