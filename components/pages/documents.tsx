'use client'

import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, Download, Eye, FileText, Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { DocumentsData } from '@/types/portal'

export function Documents({ data }: { data: DocumentsData }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") ?? "")
  const selectedCategory = searchParams.get("category") ?? "Все"
  const page = Number(searchParams.get("page") ?? data.page ?? 1)
  const total = data.total ?? data.documents.length
  const limit = data.limit ?? 20
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const applyQuery = (next: { category?: string; search?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.category !== undefined) {
      if (!next.category || next.category === "Все") params.delete("category")
      else params.set("category", next.category)
    }
    if (next.search !== undefined) {
      if (!next.search.trim()) params.delete("search")
      else params.set("search", next.search.trim())
    }
    if (next.page !== undefined) {
      if (next.page <= 1) params.delete("page")
      else params.set("page", String(next.page))
    }
    startTransition(() => {
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  const pageRange = useMemo(() => {
    if (totalPages <= 1) return []
    return Array.from({ length: totalPages }, (_, idx) => idx + 1)
  }, [totalPages])

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-primary">
          Документы
        </h1>
        <p className="mt-2 text-muted-foreground">
          Вся необходимая корпоративная документация в одном месте
        </p>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6 p-6">
        <div className="grid gap-4">
          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault()
              applyQuery({ search: searchTerm, page: 1 })
            }}
          >
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Поиск документов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </form>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {data.categories.map((cat) => (
              <button
                key={cat}
                onClick={() => applyQuery({ category: cat, page: 1 })}
                className={`whitespace-nowrap rounded-lg px-4 py-2 font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Documents List */}
      <div className="space-y-3">
        {data.documents.map((doc) => (
          <Card
            key={doc.id}
            className="p-6 hover:shadow-lg transition-all cursor-pointer hover:border-secondary/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-1 items-start gap-4">
                <div className="mt-1 rounded-lg bg-secondary/10 p-3">
                  <FileText className="h-6 w-6 text-secondary" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-semibold text-foreground">
                    {doc.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-secondary">
                      {doc.category}
                    </span>
                    <span>v{doc.version}</span>
                    <span>{doc.date}</span>
                    <span>{doc.size}</span>
                    <span className="text-muted-foreground">{doc.owner}</span>
                    {doc.access === 'restricted' && (
                      <span className="flex items-center gap-1 text-destructive">
                        <Lock className="h-3 w-3" />
                        Ограничен
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="rounded-lg border border-border p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Eye className="h-5 w-5" />
                </button>
                <button className="rounded-lg border border-border p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {data.documents.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-lg text-muted-foreground">
            Документы не найдены
          </p>
        </Card>
      )}

      {pageRange.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {pageRange.map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => applyQuery({ page: pageNum })}
              className={`rounded-md px-3 py-1.5 text-sm ${
                pageNum === page
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-border"
              }`}
            >
              {pageNum}
            </button>
          ))}
        </div>
      )}

      {isPending && <p className="mt-4 text-sm text-muted-foreground">Загрузка данных...</p>}
    </div>
  )
}
