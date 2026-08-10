"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function TicketSlaForm() {
  const [firstResponseMinutes, setFirstResponseMinutes] = useState("60")
  const [resolveMinutes, setResolveMinutes] = useState("1440")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const response = await fetch("/api/admin/ticket-sla")
        if (!response.ok) return
        const body = (await response.json()) as {
          defaultPolicy?: { firstResponseMinutes: number; resolveMinutes: number }
        }
        if (!mounted || !body.defaultPolicy) return
        setFirstResponseMinutes(String(body.defaultPolicy.firstResponseMinutes))
        setResolveMinutes(String(body.defaultPolicy.resolveMinutes))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const response = await fetch("/api/admin/ticket-sla", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstResponseMinutes: Number(firstResponseMinutes),
          resolveMinutes: Number(resolveMinutes),
          categoryId: null,
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось сохранить")
        return
      }
      setSaved(true)
    } catch {
      setError("Сетевая ошибка")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">SLA поддержки</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Политика по умолчанию: время первого ответа и полного решения заявки.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : (
        <form onSubmit={(e) => void onSave(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sla-first">Первый ответ (минуты)</Label>
            <Input
              id="sla-first"
              type="number"
              min={1}
              value={firstResponseMinutes}
              onChange={(e) => setFirstResponseMinutes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sla-resolve">Решение (минуты)</Label>
            <Input
              id="sla-resolve"
              type="number"
              min={1}
              value={resolveMinutes}
              onChange={(e) => setResolveMinutes(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {saved ? <p className="text-sm text-emerald-700">Сохранено</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Сохраняем..." : "Сохранить"}
          </Button>
        </form>
      )}
    </Card>
  )
}
