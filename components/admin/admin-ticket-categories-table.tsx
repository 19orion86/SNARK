"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { slugifyTicketCategory } from "@/lib/portal-data/ticket-categories"
import type { TicketCategoriesResponse, TicketCategoryItem } from "@/types/portal"

interface AdminTicketCategoriesTableProps {
  initial: TicketCategoriesResponse
}

interface FormState {
  slug: string
  label: string
  description: string
  sortOrder: string
  isActive: boolean
}

const emptyForm = (): FormState => ({
  slug: "",
  label: "",
  description: "",
  sortOrder: "0",
  isActive: true,
})

export function AdminTicketCategoriesTable({ initial }: AdminTicketCategoriesTableProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [items, setItems] = useState(initial.items)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ru")),
    [items]
  )

  const resetForm = () => {
    setForm(emptyForm())
    setEditingId(null)
    setError(null)
  }

  const startEdit = (item: TicketCategoryItem) => {
    setEditingId(item.id)
    setForm({
      slug: item.slug,
      label: item.label,
      description: item.description ?? "",
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    })
    setError(null)
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    const payload = {
      slug: form.slug.trim() || slugifyTicketCategory(form.label),
      label: form.label.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    }

    if (!payload.label) {
      setError("Укажите название категории")
      setSaving(false)
      return
    }

    try {
      const url = editingId ? `/api/admin/ticket-categories/${editingId}` : "/api/admin/ticket-categories"
      const method = editingId ? "PATCH" : "POST"
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await response.json().catch(() => ({}))) as TicketCategoryItem & { error?: string }
      if (!response.ok) {
        setError(body.error ?? "Не удалось сохранить категорию")
        return
      }

      setItems((prev) => {
        if (editingId) {
          return prev.map((item) => (item.id === editingId ? body : item))
        }
        return [...prev, body]
      })
      resetForm()
      startTransition(() => router.refresh())
    } catch {
      setError("Сетевая ошибка при сохранении")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string, label: string) => {
    const confirmed = window.confirm(`Удалить категорию «${label}»?`)
    if (!confirmed) return
    setError(null)
    try {
      const response = await fetch(`/api/admin/ticket-categories/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось удалить категорию")
        return
      }
      setItems((prev) => prev.filter((item) => item.id !== id))
      if (editingId === id) resetForm()
      startTransition(() => router.refresh())
    } catch {
      setError("Сетевая ошибка при удалении")
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-card-foreground">Категории поддержки</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Настройте направления заявок, которые видят сотрудники при обращении в поддержку.
        </p>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{editingId ? "Редактирование" : "Новая категория"}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category-label">Название</Label>
            <Input
              id="category-label"
              value={form.label}
              onChange={(event) => {
                const label = event.target.value
                setForm((prev) => ({
                  ...prev,
                  label,
                  slug: editingId ? prev.slug : slugifyTicketCategory(label),
                }))
              }}
              placeholder="Например: Юридический отдел"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-slug">Код (slug)</Label>
            <Input
              id="category-slug"
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: slugifyTicketCategory(event.target.value) }))}
              placeholder="legal"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="category-description">Описание</Label>
            <Textarea
              id="category-description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={2}
              placeholder="Кратко: какие вопросы относить к этой категории"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-sort">Порядок сортировки</Label>
            <Input
              id="category-sort"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch
              id="category-active"
              checked={form.isActive}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor="category-active">Активна для сотрудников</Label>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button
            type="button"
            className="bg-[#16223b] hover:bg-[#16223b]/90"
            disabled={saving || pending}
            onClick={() => void submit()}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {saving ? "Сохранение..." : editingId ? "Сохранить изменения" : "Добавить категорию"}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Отмена
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Код</TableHead>
              <TableHead>Порядок</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.label}</div>
                  {item.description ? (
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  ) : null}
                </TableCell>
                <TableCell>{item.slug}</TableCell>
                <TableCell>{item.sortOrder}</TableCell>
                <TableCell>{item.isActive ? "Активна" : "Скрыта"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void remove(item.id, item.label)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
