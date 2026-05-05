"use client"

import { useEffect, useMemo, useState } from "react"
import { EmployeeImport } from "@/components/admin/employee-import"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { AdminEmployeeItem, AdminEmployeeUpsertPayload } from "@/types/portal"

type SheetMode = "create" | "edit"

type AdminEmployeeForm = Omit<AdminEmployeeUpsertPayload, "fullName"> & {
  lastName: string
  firstName: string
  middleName: string
}

const DEFAULT_FORM: AdminEmployeeForm = {
  lastName: "",
  firstName: "",
  middleName: "",
  positionTitle: "",
  departmentName: "",
  phone: "",
  email: "",
  birthDate: "",
  startDate: "",
  welcomeNote: "",
}

function formatBirthdayPublic(date?: string | null): string {
  if (!date) return "-"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return "-"
  const day = String(parsed.getDate()).padStart(2, "0")
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  return `${day}.${month}`
}

function statusLabel(status: AdminEmployeeItem["status"]): string {
  if (status === "active") return "В офисе"
  if (status === "vacation") return "В отпуске"
  if (status === "remote") return "Удаленно"
  return "Скрыт"
}

export default function AdminEmployeesPage() {
  const [items, setItems] = useState<AdminEmployeeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<SheetMode>("create")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AdminEmployeeForm>(DEFAULT_FORM)

  const pageTitle = useMemo(
    () => (sheetMode === "create" ? "Добавить сотрудника" : "Редактировать сотрудника"),
    [sheetMode]
  )

  const loadEmployees = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/employees", { cache: "no-store" })
      const body = (await response.json()) as { items?: AdminEmployeeItem[]; error?: string }
      if (!response.ok) {
        setError(body.error ?? "Не удалось загрузить сотрудников.")
        return
      }
      setItems(body.items ?? [])
    } catch {
      setError("Ошибка сети при загрузке сотрудников.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEmployees()
  }, [])

  const openCreateSheet = () => {
    setSheetMode("create")
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setSheetOpen(true)
  }

  const openEditSheet = (item: AdminEmployeeItem) => {
    const parts = item.fullName.trim().split(/\s+/)
    setSheetMode("edit")
    setEditingId(item.id)
    setForm({
      lastName: parts[0] ?? "",
      firstName: parts[1] ?? "",
      middleName: parts.slice(2).join(" "),
      positionTitle: item.positionTitle,
      departmentName: item.departmentName,
      phone: item.phone ?? "",
      email: item.email,
      birthDate: item.birthDate ?? "",
      startDate: item.startDate ?? "",
      welcomeNote: item.welcomeNote ?? "",
      status: item.status,
    })
    setSheetOpen(true)
  }

  const handleSubmit = async () => {
    setError(null)
    const url = sheetMode === "create" ? "/api/admin/employees" : `/api/admin/employees/${editingId}`
    const method = sheetMode === "create" ? "POST" : "PATCH"
    const payload: AdminEmployeeUpsertPayload = {
      positionTitle: form.positionTitle.trim(),
      departmentName: form.departmentName.trim(),
      phone: form.phone?.trim() || undefined,
      email: form.email.trim(),
      birthDate: form.birthDate?.trim() || undefined,
      startDate: form.startDate?.trim() || undefined,
      welcomeNote: form.welcomeNote?.trim() || undefined,
      status: sheetMode === "edit" ? (form.status ?? "active") : "active",
      fullName: [form.lastName, form.firstName, form.middleName]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" "),
    }
    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? "Не удалось сохранить сотрудника.")
        return
      }
      setSheetOpen(false)
      await loadEmployees()
    } catch {
      setError("Ошибка сети при сохранении сотрудника.")
    }
  }

  const handleHide = async (id: string, hidden: boolean) => {
    setError(null)
    try {
      const response = await fetch(`/api/admin/employees/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? "Не удалось изменить видимость сотрудника.")
        return
      }
      await loadEmployees()
    } catch {
      setError("Ошибка сети при изменении видимости.")
    }
  }

  const handleDelete = async (id: string, fullName: string) => {
    const confirmed = window.confirm(`Удалить сотрудника "${fullName}" навсегда?\nЭто действие нельзя отменить.`)
    if (!confirmed) return

    setError(null)
    try {
      const response = await fetch(`/api/admin/employees/${id}`, { method: "DELETE" })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? "Не удалось удалить сотрудника.")
        return
      }
      await loadEmployees()
    } catch {
      setError("Ошибка сети при удалении сотрудника.")
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-card-foreground">Сотрудники</h1>
            <p className="text-sm text-muted-foreground">Управление кадровым списком и импорт из Excel.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowImport((current) => !current)}>
              Импортировать из Excel
            </Button>
            <Button className="bg-[#16223b] hover:bg-[#16223b]/90" onClick={openCreateSheet}>
              Добавить сотрудника
            </Button>
          </div>
        </div>
      </Card>

      {showImport && <EmployeeImport onImported={loadEmployees} />}

      <Card className="p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : (
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">ФИО</TableHead>
                <TableHead className="w-[140px]">Должность</TableHead>
                <TableHead className="w-[130px]">Отдел</TableHead>
                <TableHead className="w-[120px]">Телефон</TableHead>
                <TableHead className="w-[120px]">Email</TableHead>
                <TableHead className="hidden w-[90px] 2xl:table-cell">День рождения</TableHead>
                <TableHead className="hidden w-[100px] 2xl:table-cell">Дата выхода</TableHead>
                <TableHead className="w-[95px]">Статус</TableHead>
                <TableHead className="w-[90px] text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="w-[240px] whitespace-normal break-words" title={item.fullName}>
                    {item.fullName}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate" title={item.positionTitle}>
                    {item.positionTitle}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate" title={item.departmentName}>
                    {item.departmentName}
                  </TableCell>
                  <TableCell>{item.phone ?? "-"}</TableCell>
                  <TableCell className="max-w-[160px] truncate" title={item.email}>
                    {item.email}
                  </TableCell>
                  <TableCell className="hidden 2xl:table-cell">{formatBirthdayPublic(item.birthDate)}</TableCell>
                  <TableCell className="hidden 2xl:table-cell">{item.startDate ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{statusLabel(item.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs">
                          Действия
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditSheet(item)}>Редактировать</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleHide(item.id, item.isActive)}>
                          {item.isActive ? "Скрыть" : "Показать"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(item.id, item.fullName)}
                        >
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                    Здесь пока нет сотрудников.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{pageTitle}</SheetTitle>
            <SheetDescription>Заполните поля сотрудника и сохраните изменения.</SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 px-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="lastName">
                Фамилия <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Иванов"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">
                Имя <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="Иван"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">
                Отчество <span className="text-muted-foreground text-xs">(необязательно)</span>
              </Label>
              <Input
                id="middleName"
                value={form.middleName}
                onChange={(e) => setForm((prev) => ({ ...prev, middleName: e.target.value }))}
                placeholder="Иванович"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="positionTitle">Должность</Label>
              <Input
                id="positionTitle"
                value={form.positionTitle}
                onChange={(event) => setForm((prev) => ({ ...prev, positionTitle: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentName">Отдел</Label>
              <Input
                id="departmentName"
                value={form.departmentName}
                onChange={(event) => setForm((prev) => ({ ...prev, departmentName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                value={form.phone ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="birthDate">Дата рождения</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={form.birthDate ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Дата выхода</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcomeNote">Приветствие</Label>
              <Textarea
                id="welcomeNote"
                value={form.welcomeNote ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, welcomeNote: event.target.value }))}
              />
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
              Отмена
            </Button>
            <Button type="button" className="bg-[#16223b] hover:bg-[#16223b]/90" onClick={handleSubmit}>
              Сохранить
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
