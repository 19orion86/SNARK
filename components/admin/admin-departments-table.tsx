"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type {
  AdminDepartmentItem,
  AdminDepartmentsResponse,
  AdminEmployeeItem,
} from "@/types/portal"

interface AdminDepartmentsTableProps {
  initial: AdminDepartmentsResponse
  employees: AdminEmployeeItem[]
}

const SENTINEL_NONE = "__none__"

interface FormState {
  name: string
  code: string
  description: string
  parentId: string
  headUserId: string
  contactEmail: string
}

function emptyForm(): FormState {
  return {
    name: "",
    code: "",
    description: "",
    parentId: SENTINEL_NONE,
    headUserId: SENTINEL_NONE,
    contactEmail: "",
  }
}

function fromItem(item: AdminDepartmentItem): FormState {
  return {
    name: item.name,
    code: item.code ?? "",
    description: item.description ?? "",
    parentId: item.parentId ?? SENTINEL_NONE,
    headUserId: item.headUserId ?? SENTINEL_NONE,
    contactEmail: item.contactEmail ?? "",
  }
}

export function AdminDepartmentsTable({ initial, employees }: AdminDepartmentsTableProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<AdminDepartmentItem | null>(null)
  const [isPending, startTransition] = useTransition()

  const items = initial.items

  const activeEmployees = useMemo(
    () => employees.filter((emp) => emp.status !== "dismissed"),
    [employees]
  )

  const handleOpenCreate = () => {
    setEditing(null)
    setError(null)
    setSheetOpen(true)
  }

  const handleOpenEdit = (item: AdminDepartmentItem) => {
    setEditing(item)
    setError(null)
    setSheetOpen(true)
  }

  const handleDelete = async (item: AdminDepartmentItem) => {
    if (!window.confirm(`Удалить «${item.name}»? Это действие нельзя отменить.`)) {
      return
    }
    setError(null)
    try {
      const response = await fetch(`/api/admin/departments/${item.id}`, { method: "DELETE" })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось удалить подразделение")
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError("Ошибка сети при удалении подразделения")
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-6">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">
            Управление подразделениями
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Иерархия, руководители и контактные данные для справочника компании.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/structure-import">
            <Button variant="outline">Импорт из 1С</Button>
          </Link>
          <Button
            className="bg-[#16223b] hover:bg-[#16223b]/90"
            onClick={handleOpenCreate}
          >
            Создать подразделение
          </Button>
        </div>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="p-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Здесь пока нет подразделений. Создайте первое.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Код</TableHead>
                <TableHead>Руководитель</TableHead>
                <TableHead className="text-right">Сотрудников</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-card-foreground">
                    {item.name}
                    {item.parentName && (
                      <div className="text-xs text-muted-foreground">
                        в составе «{item.parentName}»
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{item.code ?? "—"}</TableCell>
                  <TableCell>{item.headName ?? "Не назначен"}</TableCell>
                  <TableCell className="text-right">{item.employeeCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Редактировать"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Удалить"
                        disabled={isPending}
                        onClick={() => void handleDelete(item)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <DepartmentFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        items={items}
        employees={activeEmployees}
        onSaved={() => {
          setSheetOpen(false)
          startTransition(() => router.refresh())
        }}
      />
    </div>
  )
}

interface DepartmentFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: AdminDepartmentItem | null
  items: AdminDepartmentItem[]
  employees: AdminEmployeeItem[]
  onSaved: () => void
}

function DepartmentFormSheet({
  open,
  onOpenChange,
  editing,
  items,
  employees,
  onSaved,
}: DepartmentFormSheetProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(editing ? fromItem(editing) : emptyForm())
    setError(null)
    setSubmitting(false)
  }, [open, editing])

  const parentOptions = useMemo(
    () => items.filter((item) => (editing ? item.id !== editing.id : true)),
    [items, editing]
  )

  const handleSubmit = async () => {
    setError(null)
    const trimmedName = form.name.trim()
    if (!trimmedName) {
      setError("Укажите название подразделения")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: trimmedName,
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        parentId: form.parentId === SENTINEL_NONE ? null : form.parentId,
        headUserId: form.headUserId === SENTINEL_NONE ? null : form.headUserId,
        contactEmail: form.contactEmail.trim() || null,
      }
      const url = editing
        ? `/api/admin/departments/${editing.id}`
        : "/api/admin/departments"
      const method = editing ? "PUT" : "POST"
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось сохранить подразделение")
        return
      }
      onSaved()
    } catch {
      setError("Ошибка сети при сохранении")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {editing ? "Редактирование подразделения" : "Новое подразделение"}
          </SheetTitle>
          <SheetDescription>
            Заполните основные сведения. Поля со звёздочкой обязательны.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">
              Название <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dept-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dept-code">Код</Label>
            <Input
              id="dept-code"
              placeholder="IT, HR, ACC"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dept-description">Описание</Label>
            <Textarea
              id="dept-description"
              className="min-h-24"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dept-parent">Родительское подразделение</Label>
            <Select
              value={form.parentId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, parentId: value }))}
            >
              <SelectTrigger id="dept-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL_NONE}>— Нет —</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dept-head">Руководитель</Label>
            <Select
              value={form.headUserId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, headUserId: value }))}
            >
              <SelectTrigger id="dept-head" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL_NONE}>— Не назначен —</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.fullName}
                    {employee.positionTitle ? ` — ${employee.positionTitle}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dept-email">Email для связи</Label>
            <Input
              id="dept-email"
              type="email"
              placeholder="department@almacorgroup.ru"
              value={form.contactEmail}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contactEmail: event.target.value }))
              }
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            className="bg-[#16223b] hover:bg-[#16223b]/90"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
