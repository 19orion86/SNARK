"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Building2, ChevronRight, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type {
  OrgStructureImportPreview,
  OrgStructureImportResult,
  OrgStructurePreviewTreeNode,
} from "@/types/portal"

interface StructureImportProps {
  onImported?: () => void
}

const ACTION_LABELS = {
  create: "Создать",
  update: "Обновить",
  unchanged: "Без изменений",
} as const

function PreviewTreeNode({
  node,
  depth = 0,
}: {
  node: OrgStructurePreviewTreeNode
  depth?: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0

  return (
    <li className="space-y-1">
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            aria-label={expanded ? "Свернуть" : "Развернуть"}
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="h-6 w-6" />
        )}
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.name}</span>
        <span className="text-xs text-muted-foreground">штат: {node.plannedHeadcount}</span>
      </div>
      {hasChildren && expanded ? (
        <ul className="ml-6 space-y-1 border-l border-border pl-3">
          {node.children.map((child) => (
            <PreviewTreeNode key={child.name} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function StructureImport({ onImported }: StructureImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<OrgStructureImportPreview | null>(null)
  const [result, setResult] = useState<OrgStructureImportResult | null>(null)
  const [applyDepartments, setApplyDepartments] = useState(true)
  const [applyEmployees, setApplyEmployees] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const departmentSummary = useMemo(() => {
    if (!preview) return null
    return {
      create: preview.departmentDiff.filter((item) => item.action === "create").length,
      update: preview.departmentDiff.filter((item) => item.action === "update").length,
      unchanged: preview.departmentDiff.filter((item) => item.action === "unchanged").length,
    }
  }, [preview])

  const employeeSummary = useMemo(() => {
    if (!preview) return null
    return {
      create: preview.employeeDiff.filter((item) => item.action === "create").length,
      update: preview.employeeDiff.filter((item) => item.action === "update").length,
      unchanged: preview.employeeDiff.filter((item) => item.action === "unchanged").length,
    }
  }, [preview])

  const requestPreview = async (picked: File) => {
    const formData = new FormData()
    formData.append("file", picked)
    formData.append("mode", "preview")
    const response = await fetch("/api/admin/structure/import", {
      method: "POST",
      body: formData,
    })
    const body = (await response.json()) as OrgStructureImportPreview & { error?: string }
    if (!response.ok) {
      throw new Error(body.error ?? "Не удалось разобрать файл")
    }
    return body
  }

  const handleFileChange = async (picked: File | null) => {
    setResult(null)
    setError(null)
    setPreview(null)
    setFile(picked)
    if (!picked) return

    if (!picked.name.toLowerCase().endsWith(".xlsx")) {
      setError("Поддерживаются только .xlsx файлы.")
      return
    }

    setIsLoading(true)
    try {
      const data = await requestPreview(picked)
      setPreview(data)
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Не удалось прочитать файл.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = async () => {
    if (!file) return
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mode", "apply")
      formData.append("applyDepartments", String(applyDepartments))
      formData.append("applyEmployees", String(applyEmployees))
      formData.append("syncMode", "merge")

      const response = await fetch("/api/admin/structure/import", {
        method: "POST",
        body: formData,
      })
      const body = (await response.json()) as OrgStructureImportResult & { error?: string }
      if (!response.ok) {
        setError(body.error ?? "Не удалось применить импорт.")
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
    <Card className="space-y-5 p-5">
      <div className="rounded-lg border border-dashed border-[#16223b]/40 p-4">
        <p className="text-sm font-medium text-card-foreground">Загрузите выгрузку 1С «Штатная расстановка»</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Формат .xlsx с иерархией подразделений, позиций и сотрудников. Перед применением показывается превью дерева и
          список изменений.
        </p>
        <Input
          className="mt-3"
          type="file"
          accept=".xlsx"
          onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
        />
      </div>

      {preview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4" />
                Подразделения
              </div>
              <p className="mt-1 text-2xl font-bold">{preview.stats.departments}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Сотрудники
              </div>
              <p className="mt-1 text-2xl font-bold">{preview.stats.employees}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                Предупреждения
              </div>
              <p className="mt-1 text-2xl font-bold">{preview.warnings.length}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Превью дерева</p>
              <div className="max-h-80 overflow-auto rounded-lg border border-border p-3">
                <ul className="space-y-1">
                  {preview.tree.map((node) => (
                    <PreviewTreeNode key={node.name} node={node} />
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              {departmentSummary ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">Изменения по отделам</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">Создать: {departmentSummary.create}</Badge>
                    <Badge variant="secondary">Обновить: {departmentSummary.update}</Badge>
                    <Badge variant="outline">Без изменений: {departmentSummary.unchanged}</Badge>
                  </div>
                </div>
              ) : null}

              {employeeSummary ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">Изменения по сотрудникам</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">Создать: {employeeSummary.create}</Badge>
                    <Badge variant="secondary">Обновить: {employeeSummary.update}</Badge>
                    <Badge variant="outline">Без изменений: {employeeSummary.unchanged}</Badge>
                  </div>
                </div>
              ) : null}

              {preview.warnings.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="text-sm font-medium">Предупреждения парсера</p>
                  <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-muted-foreground">
                    {preview.warnings.slice(0, 8).map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Что применить</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="apply-departments"
                checked={applyDepartments}
                onCheckedChange={(checked) => setApplyDepartments(checked === true)}
              />
              <Label htmlFor="apply-departments">Применить подразделения (иерархия и штатная численность)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="apply-employees"
                checked={applyEmployees}
                onCheckedChange={(checked) => setApplyEmployees(checked === true)}
              />
              <Label htmlFor="apply-employees">
                Загрузить сотрудников из файла (создать новых и обновить существующих по ФИО)
              </Label>
            </div>
          </div>

          <div className="max-h-56 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Отдел</TableHead>
                  <TableHead>Родитель</TableHead>
                  <TableHead>Штат</TableHead>
                  <TableHead>Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.departmentDiff.slice(0, 20).map((item) => (
                  <TableRow key={item.externalKey}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.parentName ?? "—"}</TableCell>
                    <TableCell>{item.plannedHeadcount}</TableCell>
                    <TableCell>{ACTION_LABELS[item.action]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleApply}
          disabled={!file || !preview || isLoading || (!applyDepartments && !applyEmployees)}
        >
          {isLoading ? "Обработка..." : "Применить импорт"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium text-card-foreground">Результат импорта</p>
          <p className="text-sm">Отделов создано: {result.departmentsCreated}</p>
          <p className="text-sm">Отделов обновлено: {result.departmentsUpdated}</p>
          <p className="text-sm">Сотрудников создано: {result.employeesCreated}</p>
          <p className="text-sm">Сотрудников обновлено: {result.employeesUpdated}</p>
          <p className="text-sm">Не удалось загрузить: {result.employeesNotFound}</p>
          {result.warnings.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {result.warnings.slice(0, 8).map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}
