"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { NewsListItem, NewsListResponse } from "@/types/portal"

function categoryLabel(category: NewsListItem["category"]): string {
  if (category === "company") return "Компания"
  if (category === "projects") return "Проекты"
  if (category === "people") return "Люди"
  return "Важно"
}

export default function AdminNewsPage() {
  const [items, setItems] = useState<NewsListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/news?category=all&page=1&limit=100")
      const body = (await response.json()) as NewsListResponse & { error?: string }
      if (!response.ok) {
        setError(body.error ?? "Не удалось загрузить новости")
        return
      }
      setItems(body.items)
    } catch {
      setError("Ошибка сети при загрузке новостей")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const remove = async (id: string) => {
    setError(null)
    const response = await fetch(`/api/news/${id}`, { method: "DELETE" })
    const body = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(body.error ?? "Не удалось удалить новость")
      return
    }
    await load()
  }

  const togglePin = async (item: NewsListItem) => {
    setError(null)
    const response = await fetch(`/api/news/${item.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: item.title,
        body: item.body,
        category: item.category,
        coverUrl: item.coverUrl ?? undefined,
        isPinned: !item.isPinned,
        status: item.status,
        publishedAt: item.publishedAt ?? undefined,
      }),
    })
    const body = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(body.error ?? "Не удалось изменить закрепление")
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-6">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">Редактор новостей</h1>
          <p className="mt-1 text-sm text-muted-foreground">Управление публикациями корпоративной ленты.</p>
        </div>
        <Link href="/admin/news/new">
          <Button className="bg-[#16223b] hover:bg-[#16223b]/90">Создать новость</Button>
        </Link>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заголовок</TableHead>
                <TableHead>Рубрика</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{categoryLabel(item.category)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.status === "published" ? "Опубликовано" : "Черновик"}</Badge>
                  </TableCell>
                  <TableCell>{new Date(item.publishedAt ?? item.createdAt).toLocaleDateString("ru-RU")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/news/${item.id}/edit`}>
                        <Button variant="outline" size="sm">
                          Редактировать
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm" onClick={() => void togglePin(item)}>
                        {item.isPinned ? "Открепить" : "Закрепить"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void remove(item.id)}>
                        Удалить
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
