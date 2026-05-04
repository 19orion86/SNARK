"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { NewsCategory, NewsEditorPayload, NewsListItem } from "@/types/portal"

interface NewsEditorFormProps {
  newsId?: string
}

const CATEGORY_OPTIONS: Array<{ value: NewsCategory; label: string }> = [
  { value: "company", label: "Компания" },
  { value: "projects", label: "Проекты" },
  { value: "people", label: "Люди" },
  { value: "important", label: "Важно" },
]

const DEFAULT_FORM: NewsEditorPayload = {
  title: "",
  body: "",
  category: "company",
  coverUrl: "",
  isPinned: false,
  status: "draft",
}

export function NewsEditorForm({ newsId }: NewsEditorFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<NewsEditorPayload>(DEFAULT_FORM)
  const [loading, setLoading] = useState(Boolean(newsId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!newsId) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/news/${newsId}`)
        const body = (await response.json()) as { item?: NewsListItem | null; error?: string }
        if (!response.ok || !body.item) {
          setError(body.error ?? "Не удалось загрузить новость")
          return
        }
        setForm({
          title: body.item.title,
          body: body.item.body,
          category: body.item.category,
          coverUrl: body.item.coverUrl ?? "",
          isPinned: body.item.isPinned,
          status: body.item.status,
          publishedAt: body.item.publishedAt ?? undefined,
        })
      } catch {
        setError("Ошибка сети при загрузке новости")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [newsId])

  const previewText = useMemo(() => form.body || "_Начните вводить markdown..._", [form.body])

  const uploadCover = async (file: File | null) => {
    if (!file) return
    setError(null)
    try {
      const prep = await fetch("/api/news/cover-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      })
      const prepBody = (await prep.json()) as {
        uploadUrl?: string
        fileUrl?: string
        error?: string
      }
      if (!prep.ok || !prepBody.uploadUrl || !prepBody.fileUrl) {
        setError(prepBody.error ?? "Не удалось подготовить загрузку обложки")
        return
      }
      const uploaded = await fetch(prepBody.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      })
      if (!uploaded.ok) {
        setError("Не удалось загрузить обложку")
        return
      }
      setForm((prev) => ({ ...prev, coverUrl: prepBody.fileUrl }))
    } catch {
      setError("Ошибка сети при загрузке обложки")
    }
  }

  const submit = async (status: "draft" | "published") => {
    setSaving(true)
    setError(null)
    try {
      const payload: NewsEditorPayload = {
        ...form,
        status,
      }
      const url = newsId ? `/api/news/${newsId}` : "/api/news"
      const method = newsId ? "PUT" : "POST"
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? "Не удалось сохранить новость")
        return
      }
      router.push("/admin/news")
      router.refresh()
    } catch {
      setError("Ошибка сети при сохранении новости")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Card className="p-6 text-sm text-muted-foreground">Загрузка...</Card>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/admin/news" className="text-sm text-primary hover:underline">
          ← К списку новостей
        </Link>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => submit("draft")}>
            Сохранить черновик
          </Button>
          <Button type="button" className="bg-[#16223b] hover:bg-[#16223b]/90" disabled={saving} onClick={() => submit("published")}>
            Опубликовать
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="news-title">Заголовок</Label>
            <Input
              id="news-title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="news-category">Рубрика</Label>
            <Select
              value={form.category}
              onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as NewsCategory }))}
            >
              <SelectTrigger id="news-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="news-body">Тело (Markdown)</Label>
            <Textarea
              id="news-body"
              className="min-h-56"
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="news-cover-file">Обложка</Label>
            <Input
              id="news-cover-file"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) => void uploadCover(event.target.files?.[0] ?? null)}
            />
            {form.coverUrl && (
              <p className="truncate text-xs text-muted-foreground" title={form.coverUrl}>
                {form.coverUrl}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="news-pinned"
              checked={Boolean(form.isPinned)}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isPinned: checked }))}
            />
            <Label htmlFor="news-pinned">Закрепить новость</Label>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold text-card-foreground">Превью</h2>
          {form.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.coverUrl} alt="Обложка новости" className="aspect-video w-full rounded-md object-cover" />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
              16:9
            </div>
          )}
          <h3 className="text-xl font-semibold text-card-foreground">{form.title || "Без заголовка"}</h3>
          <div className="prose prose-sm max-w-none text-card-foreground">
            <ReactMarkdown>{previewText}</ReactMarkdown>
          </div>
        </Card>
      </div>
    </div>
  )
}
