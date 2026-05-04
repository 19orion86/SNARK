import Link from "next/link"
import ReactMarkdown from "react-markdown"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { loadNewsById } from "@/lib/portal-data/loaders"

interface NewsDetailPageProps {
  params: Promise<{ id: string }>
}

function categoryLabel(category: string): string {
  if (category === "company") return "Компания"
  if (category === "projects") return "Проекты"
  if (category === "people") return "Люди"
  return "Важно"
}

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { id } = await params
  const data = await loadNewsById(id)
  const item = data.item

  if (!item) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Новость не найдена.</p>
        <Link href="/news" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Все новости
        </Link>
      </Card>
    )
  }

  return (
    <article className="space-y-4">
      <Link href="/news" className="inline-block text-sm text-primary hover:underline">
        ← Все новости
      </Link>
      <Card className="overflow-hidden">
        <div className="aspect-video bg-muted">
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">16:9</div>
          )}
        </div>
        <div className="space-y-4 p-6">
          <Badge variant="secondary">{categoryLabel(item.category)}</Badge>
          <h1 className="text-3xl font-bold text-card-foreground">{item.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{new Date(item.publishedAt ?? item.createdAt).toLocaleDateString("ru-RU")}</span>
            <span>{item.authorName}</span>
          </div>
          <div className="prose prose-sm max-w-none text-card-foreground">
            <ReactMarkdown>{item.body}</ReactMarkdown>
          </div>
        </div>
      </Card>
    </article>
  )
}
