import Link from "next/link"
import { Pin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { loadNewsData } from "@/lib/portal-data/loaders"
import type { NewsCategory } from "@/types/portal"

export const dynamic = "force-dynamic"

interface NewsPageProps {
  searchParams?: Promise<{ category?: string; page?: string }>
}

const CATEGORY_OPTIONS: Array<{ value: "all" | NewsCategory; label: string }> = [
  { value: "all", label: "Все" },
  { value: "company", label: "Компания" },
  { value: "projects", label: "Проекты" },
  { value: "people", label: "Люди" },
  { value: "important", label: "Важно" },
]

function categoryLabel(category: NewsCategory): string {
  if (category === "company") return "Компания"
  if (category === "projects") return "Проекты"
  if (category === "people") return "Люди"
  return "Важно"
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const params = (await searchParams) ?? {}
  const categoryParam = params.category ?? "all"
  const pageParam = Number(params.page ?? "1")
  const category = CATEGORY_OPTIONS.some((item) => item.value === categoryParam)
    ? (categoryParam as "all" | NewsCategory)
    : "all"
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const data = await loadNewsData({ category, page, limit: 10 })
  const pages = Math.max(1, Math.ceil(data.total / data.limit))

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-card-foreground">Новости</h1>
        <p className="mt-2 text-sm text-muted-foreground">Лента новостей компании и подразделений.</p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_OPTIONS.map((option) => {
          const isActive = option.value === category
          const href = option.value === "all" ? `/news?page=1` : `/news?category=${option.value}&page=1`
          return (
            <Link
              key={option.value}
              href={href}
              className={`rounded-md px-3 py-2 text-sm ${
                isActive ? "bg-[#16223b] text-white" : "border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {option.label}
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.items.map((item) => (
          <Link key={item.id} href={`/news/${item.id}`}>
            <Card className="h-full overflow-hidden transition hover:shadow-md">
              <div className="relative aspect-video bg-muted">
                {item.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">16:9</div>
                )}
                {item.isPinned && (
                  <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-[#16223b] px-2 py-1 text-xs text-white">
                    <Pin className="h-3 w-3" />
                    Закреплено
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <Badge variant="secondary">{categoryLabel(item.category)}</Badge>
                <h2 className="line-clamp-2 text-lg font-semibold text-card-foreground">{item.title}</h2>
                <p className="line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(item.publishedAt ?? item.createdAt).toLocaleDateString("ru-RU")}</span>
                  <span>{item.authorName}</span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Link
          href={`/news?category=${category}&page=${Math.max(1, page - 1)}`}
          className={`rounded-md border px-3 py-2 text-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
        >
          Назад
        </Link>
        <span className="text-sm text-muted-foreground">
          Страница {page} из {pages}
        </span>
        <Link
          href={`/news?category=${category}&page=${Math.min(pages, page + 1)}`}
          className={`rounded-md border px-3 py-2 text-sm ${page >= pages ? "pointer-events-none opacity-40" : ""}`}
        >
          Вперед
        </Link>
      </div>
    </div>
  )
}
