import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { proxyProtocolsRequest } from "@/lib/protocols/client"
import { apiErrorSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireAuth(request)
    const { id } = await context.params
    const upstream = await proxyProtocolsRequest(`/api/v1/protocols/${id}`)
    if (!upstream.ok) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Протокол не найден", code: "NOT_FOUND" }),
        { status: upstream.status === 404 ? 404 : 503 }
      )
    }
    return NextResponse.json(await upstream.json())
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 503
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 503 ? "Сервис протоколов недоступен" : (known.message ?? "Ошибка доступа"),
        code: status === 503 ? "PROTOCOLS_UNAVAILABLE" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
