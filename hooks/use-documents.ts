"use client"

import { useEffect, useState } from "react"
import type { DocumentsData, DocumentsQuery, DocumentsResponse } from "@/types/portal"

function toDocumentsData(payload: DocumentsResponse): DocumentsData {
  return {
    documents: payload.items,
    categories: payload.categories,
    total: payload.total,
    page: payload.page,
    limit: payload.limit,
  }
}

export function useDocuments() {
  const [data, setData] = useState<DocumentsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = async (query?: DocumentsQuery) => {
    setIsLoading(true)
    setError(null)
    try {
      const searchParams = new URLSearchParams()
      if (query?.category) searchParams.set("category", query.category)
      if (query?.search) searchParams.set("search", query.search)
      if (query?.page) searchParams.set("page", String(query.page))
      if (query?.limit) searchParams.set("limit", String(query.limit))
      const suffix = searchParams.toString()

      const response = await fetch(`/api/documents${suffix ? `?${suffix}` : ""}`, {
        method: "GET",
      })

      if (!response.ok) {
        throw new Error("API documents request failed")
      }

      const result = (await response.json()) as DocumentsResponse
      setData(toDocumentsData(result))
    } catch {
      setError("Не удалось загрузить документы")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refetch()
  }, [])

  return { data, isLoading, error, refetch }
}
