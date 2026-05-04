"use client"

import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { EmployeeImportResult } from "@/types/portal"

const TEMPLATE_HEADERS = [
  "ФИО",
  "Должность",
  "Отдел",
  "Телефон",
  "Email",
  "Дата рождения",
  "Дата выхода",
  "Приветствие",
]

type PreviewRow = Record<string, string>

interface EmployeeImportProps {
  onImported?: () => void
}

function toPreviewRows(file: File): Promise<PreviewRow[]> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) return []
    const worksheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: "",
      raw: false,
    })
    return rows.slice(0, 5).map((row) => {
      const next: PreviewRow = {}
      TEMPLATE_HEADERS.forEach((header) => {
        next[header] = String(row[header] ?? "")
      })
      return next
    })
  })
}

export function EmployeeImport({ onImported }: EmployeeImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [result, setResult] = useState<EmployeeImportResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPreview = useMemo(() => previewRows.length > 0, [previewRows.length])

  const handleTemplateDownload = () => {
    const sheet = XLSX.utils.json_to_sheet([])
    XLSX.utils.sheet_add_aoa(sheet, [TEMPLATE_HEADERS], { origin: "A1" })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, "Сотрудники")
    XLSX.writeFile(workbook, "employee-import-template.xlsx")
  }

  const handleFileChange = async (picked: File | null) => {
    setResult(null)
    setError(null)
    setFile(picked)
    if (!picked) {
      setPreviewRows([])
      return
    }
    if (!picked.name.toLowerCase().endsWith(".xlsx")) {
      setError("Поддерживаются только .xlsx файлы.")
      setPreviewRows([])
      return
    }

    try {
      const rows = await toPreviewRows(picked)
      setPreviewRows(rows)
    } catch {
      setError("Не удалось прочитать файл. Проверьте формат.")
      setPreviewRows([])
    }
  }

  const handleImport = async () => {
    if (!file) return
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/admin/employees/import", {
        method: "POST",
        body: formData,
      })
      const body = (await response.json()) as EmployeeImportResult & { error?: string }
      if (!response.ok) {
        setError(body.error ?? "Не удалось импортировать сотрудников.")
        return
      }
      setResult(body)
      onImported?.()
    } catch {
      setError("Ошибка сети при импорте.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="rounded-lg border border-dashed border-[#16223b]/40 p-4">
        <p className="text-sm font-medium text-card-foreground">Загрузите Excel-файл сотрудников</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Поддерживается только формат .xlsx. Колонки должны соответствовать шаблону.
        </p>
        <Input
          className="mt-3"
          type="file"
          accept=".xlsx"
          onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handleTemplateDownload}>
          Скачать шаблон
        </Button>
        <Button type="button" onClick={handleImport} disabled={!file || isLoading}>
          {isLoading ? "Импорт..." : "Импортировать"}
        </Button>
      </div>

      {hasPreview && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-card-foreground">Превью первых 5 строк</p>
          <Table>
            <TableHeader>
              <TableRow>
                {TEMPLATE_HEADERS.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, index) => (
                <TableRow key={`${index}-${row.Email ?? ""}`}>
                  {TEMPLATE_HEADERS.map((header) => (
                    <TableCell key={header}>{row[header] || "-"}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-sm text-card-foreground">Создано: {result.created}</p>
          <p className="text-sm text-card-foreground">Обновлено: {result.updated}</p>
          <p className="text-sm text-card-foreground">Ошибок: {result.errors.length}</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {result.errors.slice(0, 10).map((item, index) => (
                <li key={`${item.row}-${index}`}>Строка {item.row}: {item.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
