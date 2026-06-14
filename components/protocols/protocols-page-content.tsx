"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { ProtocolListItem, ProtocolListResponse } from "@/types/portal"

interface ProtocolsPageContentProps {
  initial: ProtocolListResponse | null
  serviceAvailable: boolean
}

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Загружен",
  processing: "Обработка",
  transcribing: "Транскрибация",
  generating: "Генерация",
  completed: "Готов",
  failed: "Ошибка",
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function ProtocolsPageContent({ initial, serviceAvailable }: ProtocolsPageContentProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState("")
  const [meetingDate, setMeetingDate] = useState("")
  const [participants, setParticipants] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const items = initial?.items ?? []

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!file) {
      setError("Выберите аудио или видео файл")
      return
    }
    if (!title.trim() || !meetingDate.trim() || !participants.trim()) {
      setError("Заполните все поля формы")
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("title", title.trim())
      formData.set("meeting_date", meetingDate)
      formData.set(
        "participants",
        JSON.stringify(
          participants
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        )
      )

      const response = await fetch("/api/protocols/upload", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось загрузить файл")
        return
      }
      setTitle("")
      setMeetingDate("")
      setParticipants("")
      setFile(null)
      startTransition(() => router.refresh())
    } catch {
      setError("Сетевая ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {!serviceAvailable ? (
        <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Сервис протоколов не запущен. Запустите Python-сервис из{" "}
          <code className="rounded bg-white px-1">services/protocols</code> на порту 8000.
        </Card>
      ) : null}

      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Протоколы совещаний</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Загрузите аудио или видео — система расшифрует речь, сформирует протокол и поручения.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="protocol-title">Название совещания</Label>
              <Input
                id="protocol-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protocol-date">Дата</Label>
              <Input
                id="protocol-date"
                type="date"
                value={meetingDate}
                onChange={(event) => setMeetingDate(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="protocol-participants">Участники (через запятую)</Label>
            <Textarea
              id="protocol-participants"
              value={participants}
              onChange={(event) => setParticipants(event.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="protocol-file">Аудио / видео</Label>
            <Input
              id="protocol-file"
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.ogg,.m4a,.webm,.mp4,.mov,.mkv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={submitting || pending || !serviceAvailable}>
            Загрузить и обработать
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Список протоколов</h2>
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Протоколов пока нет
                </TableCell>
              </TableRow>
            ) : (
              items.map((item: ProtocolListItem) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>{formatDate(item.meetingDate)}</TableCell>
                  <TableCell>{STATUS_LABEL[item.status] ?? item.status}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/protocols/${item.id}`}>Открыть</Link>
                    </Button>
                    {item.status === "completed" ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/protocols/${item.id}/export-docx`}>DOCX</a>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
