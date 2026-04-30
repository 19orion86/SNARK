"use client"

import { useEffect, useState } from "react"
import type { ContactsData, EmployeesQuery, EmployeesResponse } from "@/types/portal"

function toContactsData(response: EmployeesResponse): ContactsData {
  return {
    employees: response.items,
    departments: response.departments,
    total: response.total,
    page: response.page,
    limit: response.limit,
  }
}

export function useContacts() {
  const [data, setData] = useState<ContactsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = async (query?: EmployeesQuery) => {
    setIsLoading(true)
    setError(null)
    try {
      const searchParams = new URLSearchParams()
      if (query?.search) searchParams.set("search", query.search)
      if (query?.department) searchParams.set("department", query.department)
      if (query?.page) searchParams.set("page", String(query.page))
      if (query?.limit) searchParams.set("limit", String(query.limit))

      const suffix = searchParams.toString()
      const response = await fetch(`/api/employees${suffix ? `?${suffix}` : ""}`, {
        method: "GET",
      })

      if (!response.ok) {
        throw new Error("API employees request failed")
      }

      const result = (await response.json()) as EmployeesResponse
      setData(toContactsData(result))
    } catch {
      setError("Не удалось загрузить справочник сотрудников")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refetch()
  }, [])

  return { data, isLoading, error, refetch }
}
