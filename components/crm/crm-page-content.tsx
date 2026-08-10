"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface DealStage {
  id: string
  name: string
  sortOrder: number
  color: string | null
}

interface Deal {
  id: string
  title: string
  companyId: string | null
  stageId: string | null
  amount: number | null
  ownerId: string | null
  source: string | null
  createdAt: string
  updatedAt: string
}

export function CrmPageContent() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [stages, setStages] = useState<DealStage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [stagesRes, dealsRes] = await Promise.all([
        fetch("/api/deal-stages"),
        fetch("/api/deals"),
      ])
      if (stagesRes.ok) {
        const body = (await stagesRes.json()) as { items: DealStage[] }
        setStages(body.items ?? [])
      }
      if (dealsRes.ok) {
        const body = (await dealsRes.json()) as { items: Deal[] }
        setDeals(body.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const columns = useMemo(() => {
    const map = new Map<string, Deal[]>()
    for (const stage of stages) map.set(stage.id, [])
    for (const deal of deals) {
      if (deal.stageId && map.has(deal.stageId)) {
        map.get(deal.stageId)!.push(deal)
      } else if (stages[0]) {
        map.get(stages[0].id)?.push(deal)
      }
    }
    return map
  }, [stages, deals])

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!title.trim()) {
      setError("Укажите название сделки")
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch("/api/deals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          amount: amount ? Number(amount) : undefined,
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Не удалось создать сделку")
        return
      }
      setTitle("")
      setAmount("")
      await load()
      startTransition(() => router.refresh())
    } catch {
      setError("Сетевая ошибка")
    } finally {
      setSubmitting(false)
    }
  }

  const moveDeal = async (dealId: string, stageId: string) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stageId, updatedAt: new Date().toISOString() } : d))
    )
    const response = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stageId }),
    })
    if (!response.ok) {
      await load()
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold text-card-foreground">CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Воронка сделок: перетащите карточку на нужную стадию.
        </p>

        <form onSubmit={onCreate} className="mt-6 grid max-w-2xl gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="deal-title">Название сделки</Label>
            <Input
              id="deal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Договор с ООО «Ромашка»"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-amount">Сумма</Label>
            <Input
              id="deal-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          {error ? <p className="text-sm text-destructive md:col-span-3">{error}</p> : null}
          <div className="md:col-span-3">
            <Button type="submit" disabled={submitting || pending}>
              {submitting ? "Создаём..." : "Создать сделку"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка воронки...</p>
        ) : stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Стадии не настроены.</p>
        ) : (
          <div className={cn("grid gap-3 overflow-x-auto pb-2 md:grid-cols-4", pending && "opacity-90")}>
            {stages.map((stage) => {
              const items = columns.get(stage.id) ?? []
              return (
                <div
                  key={stage.id}
                  className="min-w-[220px] rounded-lg border bg-muted/30 p-2"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const dealId = event.dataTransfer.getData("text/deal-id") || draggingId
                    if (dealId) void moveDeal(dealId, stage.id)
                    setDraggingId(null)
                  }}
                >
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-sm font-medium">{stage.name}</span>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((deal) => (
                      <Link
                        key={deal.id}
                        href={`/crm/${deal.id}`}
                        draggable
                        onDragStart={(event) => {
                          setDraggingId(deal.id)
                          event.dataTransfer.setData("text/deal-id", deal.id)
                        }}
                        className="block cursor-grab rounded-md border bg-background p-3 shadow-sm active:cursor-grabbing"
                      >
                        <p className="text-sm font-medium">{deal.title}</p>
                        {deal.amount != null ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Intl.NumberFormat("ru-RU").format(deal.amount)} ₽
                          </p>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
