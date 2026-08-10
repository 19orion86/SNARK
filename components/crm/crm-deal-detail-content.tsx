"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Deal {
  id: string
  title: string
  amount: number | null
  stageId: string | null
  source: string | null
  createdAt: string
  updatedAt: string
}

interface Activity {
  id: string
  body: string
  createdAt: string
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function CrmDealDetailContent() {
  const params = useParams<{ id: string }>()
  const dealId = params.id
  const [deal, setDeal] = useState<Deal | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/deals/${dealId}/activities`)
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? "Не удалось загрузить сделку")
        setDeal(null)
        return
      }
      const data = (await response.json()) as { item: Deal; activities: Activity[] }
      setDeal(data.item)
      setActivities(data.activities ?? [])
    } catch {
      setError("Сетевая ошибка")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (dealId) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId])

  const addActivity = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/deals/${dealId}/activities`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? "Не удалось добавить")
        return
      }
      setBody("")
      await load()
    } catch {
      setError("Сетевая ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>
  }

  if (!deal) {
    return (
      <Card className="space-y-3 p-6">
        <p className="text-sm text-destructive">{error ?? "Сделка не найдена"}</p>
        <Link href="/crm">
          <Button variant="outline">
            <ArrowLeft className="mr-1 h-4 w-4" />К воронке
          </Button>
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <Link href="/crm" className="mb-4 inline-flex text-sm text-muted-foreground hover:underline">
          ← CRM
        </Link>
        <h1 className="text-2xl font-semibold">{deal.title}</h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {deal.amount != null ? (
            <span>{new Intl.NumberFormat("ru-RU").format(deal.amount)} ₽</span>
          ) : null}
          <span>Создана: {formatDate(deal.createdAt)}</span>
          {deal.source ? <span>Источник: {deal.source}</span> : null}
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Активности</h2>
        <form onSubmit={(e) => void addActivity(e)} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="deal-activity">Новая запись</Label>
            <Textarea
              id="deal-activity"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Звонок, встреча, комментарий..."
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={submitting || !body.trim()}>
            Добавить
          </Button>
        </form>

        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет активностей</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {activities.map((item) => (
              <li key={item.id} className="space-y-1 p-3">
                <p className="whitespace-pre-wrap text-sm">{item.body}</p>
                <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
