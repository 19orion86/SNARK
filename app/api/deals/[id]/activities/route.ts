import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import {
  addDealActivity,
  getDeal,
  listDealActivities,
} from "@/lib/repositories/deals.repository"
import { apiErrorSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

const idSchema = z.string().uuid()
const activitySchema = z.object({
  body: z.string().trim().min(1).max(5000),
})

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireAuth(request)
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный id", code: "INVALID_ID" }),
        { status: 400 }
      )
    }
    const item = await getDeal(parsedId.data)
    if (!item) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Сделка не найдена", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }
    const activities = await listDealActivities(parsedId.data)
    return NextResponse.json({ item, activities })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить сделку" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    if (!parsedId.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный id", code: "INVALID_ID" }),
        { status: 400 }
      )
    }
    const deal = await getDeal(parsedId.data)
    if (!deal) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Сделка не найдена", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }
    const parsed = activitySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Укажите текст", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    const item = await addDealActivity({
      dealId: parsedId.data,
      authorId: auth.userId,
      body: parsed.data.body,
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось добавить"
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? message : (known.message ?? message),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
