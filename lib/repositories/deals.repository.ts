import "server-only"
import { asc, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { dealActivities, dealStages, deals } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"

export interface DealStage {
  id: string
  name: string
  sortOrder: number
  color: string | null
}

export interface Deal {
  id: string
  title: string
  companyId: string | null
  stageId: string | null
  amount: number | null
  ownerId: string | null
  source: string | null
  tags: unknown
  createdAt: string
  updatedAt: string
}

export interface DealCreatePayload {
  title: string
  companyId?: string | null
  stageId?: string | null
  amount?: number | null
  ownerId?: string | null
  source?: string | null
  tags?: unknown
}

const DEFAULT_STAGES: { name: string; sortOrder: number; color: string }[] = [
  { name: "Лид", sortOrder: 0, color: "#94a3b8" },
  { name: "Переговоры", sortOrder: 1, color: "#3b82f6" },
  { name: "Договор", sortOrder: 2, color: "#f59e0b" },
  { name: "Закрыто", sortOrder: 3, color: "#22c55e" },
]

const mockStages: DealStage[] = []
const mockDeals: Deal[] = []

function mapStage(row: {
  id: string
  name: string
  sortOrder: number
  color: string | null
}): DealStage {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    color: row.color,
  }
}

function mapDeal(row: {
  id: string
  title: string
  companyId: string | null
  stageId: string | null
  amount: number | null
  ownerId: string | null
  source: string | null
  tags: unknown
  createdAt: Date
  updatedAt: Date
}): Deal {
  return {
    id: row.id,
    title: row.title,
    companyId: row.companyId,
    stageId: row.stageId,
    amount: row.amount,
    ownerId: row.ownerId,
    source: row.source,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function ensureMockStages(): DealStage[] {
  if (mockStages.length === 0) {
    for (const stage of DEFAULT_STAGES) {
      mockStages.push({
        id: crypto.randomUUID(),
        name: stage.name,
        sortOrder: stage.sortOrder,
        color: stage.color,
      })
    }
  }
  return mockStages
}

export async function listStages(): Promise<DealStage[]> {
  if (isMockDb()) {
    return [...ensureMockStages()].sort((a, b) => a.sortOrder - b.sortOrder)
  }

  let rows = await db.select().from(dealStages).orderBy(asc(dealStages.sortOrder))
  if (rows.length === 0) {
    await db.insert(dealStages).values(DEFAULT_STAGES)
    rows = await db.select().from(dealStages).orderBy(asc(dealStages.sortOrder))
  }
  return rows.map(mapStage)
}

export async function listDeals(): Promise<Deal[]> {
  if (isMockDb()) {
    ensureMockStages()
    return [...mockDeals].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  const rows = await db.select().from(deals).orderBy(desc(deals.createdAt))
  return rows.map(mapDeal)
}

export async function createDeal(
  payload: DealCreatePayload & { ownerId?: string | null }
): Promise<Deal> {
  const stages = await listStages()
  const stageId = payload.stageId ?? stages[0]?.id ?? null

  if (isMockDb()) {
    const now = new Date().toISOString()
    const deal: Deal = {
      id: crypto.randomUUID(),
      title: payload.title,
      companyId: payload.companyId ?? null,
      stageId,
      amount: payload.amount ?? null,
      ownerId: payload.ownerId ?? null,
      source: payload.source ?? null,
      tags: payload.tags ?? null,
      createdAt: now,
      updatedAt: now,
    }
    mockDeals.unshift(deal)
    return deal
  }

  const [created] = await db
    .insert(deals)
    .values({
      title: payload.title,
      companyId: payload.companyId ?? null,
      stageId,
      amount: payload.amount ?? null,
      ownerId: payload.ownerId ?? null,
      source: payload.source ?? null,
      tags: payload.tags ?? null,
    })
    .returning()

  if (!created) throw new Error("Не удалось создать сделку")
  return mapDeal(created)
}

export async function updateDealStage(id: string, stageId: string): Promise<Deal> {
  if (isMockDb()) {
    const index = mockDeals.findIndex((d) => d.id === id)
    if (index < 0) throw new Error("Сделка не найдена")
    mockDeals[index] = {
      ...mockDeals[index],
      stageId,
      updatedAt: new Date().toISOString(),
    }
    return mockDeals[index]
  }

  const [updated] = await db
    .update(deals)
    .set({ stageId, updatedAt: new Date() })
    .where(eq(deals.id, id))
    .returning()

  if (!updated) throw new Error("Сделка не найдена")
  return mapDeal(updated)
}

export async function getDeal(id: string): Promise<Deal | null> {
  if (isMockDb()) {
    return mockDeals.find((d) => d.id === id) ?? null
  }
  const [row] = await db.select().from(deals).where(eq(deals.id, id)).limit(1)
  return row ? mapDeal(row) : null
}

export interface DealActivity {
  id: string
  dealId: string
  authorId: string | null
  body: string
  createdAt: string
}

const mockActivities: DealActivity[] = []

export async function listDealActivities(dealId: string): Promise<DealActivity[]> {
  if (isMockDb()) {
    return mockActivities
      .filter((a) => a.dealId === dealId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  const rows = await db
    .select()
    .from(dealActivities)
    .where(eq(dealActivities.dealId, dealId))
    .orderBy(desc(dealActivities.createdAt))

  return rows.map((row) => ({
    id: row.id,
    dealId: row.dealId,
    authorId: row.authorId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function addDealActivity(input: {
  dealId: string
  authorId: string
  body: string
}): Promise<DealActivity> {
  const trimmed = input.body.trim()
  if (!trimmed) throw new Error("Укажите текст активности")

  if (isMockDb()) {
    const item: DealActivity = {
      id: crypto.randomUUID(),
      dealId: input.dealId,
      authorId: input.authorId,
      body: trimmed,
      createdAt: new Date().toISOString(),
    }
    mockActivities.unshift(item)
    return item
  }

  const [created] = await db
    .insert(dealActivities)
    .values({
      dealId: input.dealId,
      authorId: input.authorId,
      body: trimmed,
    })
    .returning()

  if (!created) throw new Error("Не удалось добавить активность")
  return {
    id: created.id,
    dealId: created.dealId,
    authorId: created.authorId,
    body: created.body,
    createdAt: created.createdAt.toISOString(),
  }
}
