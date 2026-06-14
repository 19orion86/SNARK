import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { proxyProtocolsRequest } from "@/lib/protocols/client"
import { apiErrorSchema } from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    const search = request.nextUrl.search
    const upstream = await proxyProtocolsRequest(`/api/v1/protocols/${search}`)
    if (!upstream.ok) {
      const body = await upstream.text()
      return NextResponse.json(
        apiErrorSchema.parse({
          error: "Сервис протоколов недоступен",
          code: "PROTOCOLS_UNAVAILABLE",
          details: body.slice(0, 500),
        }),
        { status: upstream.status === 404 ? 503 : upstream.status }
      )
    }
    const data = await upstream.json()
    return NextResponse.json(data)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 503
    return NextResponse.json(
      apiErrorSchema.parse({
        error:
          status === 503
            ? "Сервис протоколов не запущен. Запустите services/protocols (порт 8000)."
            : (known.message ?? "Ошибка доступа"),
        code: status === 503 ? "PROTOCOLS_UNAVAILABLE" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
