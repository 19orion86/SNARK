import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { proxyProtocolsRequest } from "@/lib/protocols/client"
import { apiErrorSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    requireAuth(_request)
    const { id } = await context.params
    const upstream = await proxyProtocolsRequest(`/api/v1/protocols/${id}/export-docx`)
    if (!upstream.ok) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Не удалось экспортировать протокол", code: "EXPORT_FAILED" }),
        { status: upstream.status }
      )
    }
    const buffer = await upstream.arrayBuffer()
    const contentType =
      upstream.headers.get("content-type") ??
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    const disposition =
      upstream.headers.get("content-disposition") ?? `attachment; filename="protocol-${id}.docx"`
    return new NextResponse(buffer, {
      headers: {
        "content-type": contentType,
        "content-disposition": disposition,
      },
    })
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
