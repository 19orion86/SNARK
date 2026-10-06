import { NextRequest, NextResponse } from "next/server"
import { assistantRequest, AssistantUnavailableError } from "@/lib/assistant/client"
import { assistantErrorResponse, invalidPayloadResponse } from "@/lib/assistant/respond"
import { requireRole } from "@/lib/auth/request-auth"
import { loadUserNames } from "@/lib/repositories/assistant.repository"
import { assistantQueriesQuerySchema, type AssistantQueryLog } from "@/lib/validators/assistant"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

/** Журнал обращений к ассистенту: «карта слепых зон» базы знаний. */
export async function GET(request: NextRequest) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const parsed = assistantQueriesQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    )
    if (!parsed.success) return invalidPayloadResponse("Некорректные параметры журнала")

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((parsed.data.page - 1) * PAGE_SIZE),
    })
    if (parsed.data.status) params.set("status", parsed.data.status)
    if (parsed.data.feedback) params.set("feedback", parsed.data.feedback)

    const upstream = await assistantRequest(`/queries?${params.toString()}`)
    if (!upstream.ok) throw new AssistantUnavailableError()

    const data = (await upstream.json()) as AssistantQueryLog
    const names = await loadUserNames(data.items.map((item) => item.user_id))
    return NextResponse.json({
      ...data,
      pageSize: PAGE_SIZE,
      items: data.items.map((item) => ({ ...item, userName: names.get(item.user_id) ?? "—" })),
    })
  } catch (error) {
    return assistantErrorResponse(error)
  }
}
