"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  RAG_STATUSES,
  RAG_STATUS_LABELS,
  type AssistantQueryLog,
  type RagDocumentItem,
  type RagStatus,
} from "@/lib/validators/assistant"

const STATUS_LABELS: Record<string, string> = {
  answered: "Ответ дан",
  no_info: "Нет информации",
  contradiction: "Противоречие",
  error: "Ошибка",
}

const INDEX_LABELS: Record<string, string> = {
  pending: "В очереди",
  indexing: "Индексируется",
  indexed: "Проиндексирован",
  failed: "Ошибка",
}

type QueryFilter = "no_info" | "all" | "answered" | "contradiction" | "error" | "negative"

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
}

function QueryLog() {
  // «Нет информации» — первый фильтр: это и есть слепые зоны базы знаний.
  const [filter, setFilter] = useState<QueryFilter>("no_info")
  const [data, setData] = useState<AssistantQueryLog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (filter === "negative") params.set("feedback", "-1")
    else if (filter !== "all") params.set("status", filter)
    try {
      const response = await fetch(`/api/admin/assistant/queries?${params.toString()}`)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "Не удалось загрузить журнал")
      }
      setData((await response.json()) as AssistantQueryLog)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить журнал")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="assistant-log-filter" className="text-sm text-muted-foreground">
          Показать
        </label>
        <Select value={filter} onValueChange={(value) => setFilter(value as QueryFilter)}>
          <SelectTrigger id="assistant-log-filter" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no_info">Без ответа (слепые зоны)</SelectItem>
            <SelectItem value="negative">Отрицательные оценки</SelectItem>
            <SelectItem value="contradiction">Противоречия в документах</SelectItem>
            <SelectItem value="error">Ошибки сервиса</SelectItem>
            <SelectItem value="answered">С ответом</SelectItem>
            <SelectItem value="all">Все обращения</SelectItem>
          </SelectContent>
        </Select>
        {data && <span className="text-sm text-muted-foreground">Всего: {data.total}</span>}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {loading && <Spinner className="size-5" />}

      {data && data.frequent.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Частые вопросы</h3>
          <ol className="space-y-1 text-sm">
            {data.frequent.map((item) => (
              <li key={item.question} className="flex justify-between gap-4">
                <span>{item.question}</span>
                <span className="shrink-0 text-muted-foreground">× {item.total}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Когда</TableHead>
              <TableHead className="w-40">Сотрудник</TableHead>
              <TableHead>Вопрос</TableHead>
              <TableHead className="w-36">Статус</TableHead>
              <TableHead>Источники</TableHead>
              <TableHead className="w-20">Оценка</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Обращений нет
                </TableCell>
              </TableRow>
            )}
            {data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap text-xs">{formatDate(item.created_at)}</TableCell>
                <TableCell className="text-sm">{item.userName ?? "—"}</TableCell>
                <TableCell className="max-w-md text-sm">{item.question}</TableCell>
                <TableCell>
                  <Badge variant={item.status === "answered" ? "default" : "secondary"}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.sources.map((source) => `${source.title}${source.section ? ` (${source.section})` : ""}`).join("; ") ||
                    (item.error ? item.error.slice(0, 120) : "—")}
                </TableCell>
                <TableCell>
                  {item.feedback === 1 && <ThumbsUp className="size-4 text-emerald-600" aria-label="Полезно" />}
                  {item.feedback === -1 && <ThumbsDown className="size-4 text-destructive" aria-label="Не помогло" />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function DocumentsIndex() {
  const [items, setItems] = useState<RagDocumentItem[]>([])
  const [assistantAvailable, setAssistantAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch("/api/admin/assistant/documents")
      if (!response.ok) throw new Error("Не удалось загрузить документы")
      const data = (await response.json()) as { items: RagDocumentItem[]; assistantAvailable: boolean }
      setItems(data.items)
      setAssistantAvailable(data.assistantAvailable)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить документы")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (id: string, request: () => Promise<Response>) => {
    setBusyId(id)
    setError(null)
    try {
      const response = await request()
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "Операция не выполнена")
      }
      // Индексация идёт в фоне: обновляем состояние сразу и ещё раз через несколько секунд.
      await load()
      setTimeout(() => void load(), 4000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Операция не выполнена")
    } finally {
      setBusyId(null)
    }
  }

  const changeStatus = (id: string, ragStatus: RagStatus) =>
    act(id, () =>
      fetch(`/api/admin/documents/${id}/rag-status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ragStatus }),
      })
    )

  const reindex = (id: string) => act(id, () => fetch(`/api/admin/documents/${id}/reindex`, { method: "POST" }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ассистент отвечает только по документам со статусом «Актуален». В v1 индексируются файлы docx.
      </p>
      {!assistantAvailable && (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Сервис ассистента недоступен: состояние индексации не показано, изменения статуса будут подхвачены
          при следующей сверке.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <Spinner className="size-5" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Документ</TableHead>
              <TableHead className="w-20">Версия</TableHead>
              <TableHead className="w-44">Статус для ассистента</TableHead>
              <TableHead className="w-56">Индексация</TableHead>
              <TableHead className="w-44" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Документов нет
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id} data-testid="rag-document-row">
                <TableCell>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.fileName} · {item.access === "public" ? "общий доступ" : "доступ отдела"}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{item.version}</TableCell>
                <TableCell>
                  <Select
                    value={item.ragStatus}
                    disabled={busyId === item.id}
                    onValueChange={(value) => void changeStatus(item.id, value as RagStatus)}
                  >
                    <SelectTrigger aria-label={`Статус документа «${item.title}»`} className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RAG_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {RAG_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm">
                  {item.indexState ? (
                    <div>
                      <Badge variant={item.indexState === "failed" ? "destructive" : "secondary"}>
                        {INDEX_LABELS[item.indexState]}
                      </Badge>
                      {item.indexState === "indexed" && (
                        <span className="ml-2 text-xs text-muted-foreground">фрагментов: {item.chunkCount}</span>
                      )}
                      {item.indexError && <p className="mt-1 text-xs text-destructive">{item.indexError}</p>}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">не в индексе</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === item.id || item.ragStatus !== "actual"}
                    onClick={() => void reindex(item.id)}
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Переиндексировать
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export function AssistantAdmin() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Ассистент по базе знаний</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Журнал обращений показывает, на какие вопросы сотрудников в документах нет ответа.
        </p>
      </header>
      <Tabs defaultValue="queries">
        <TabsList>
          <TabsTrigger value="queries">Журнал обращений</TabsTrigger>
          <TabsTrigger value="documents">Документы и индексация</TabsTrigger>
        </TabsList>
        <TabsContent value="queries" className="mt-4">
          <QueryLog />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsIndex />
        </TabsContent>
      </Tabs>
    </div>
  )
}
