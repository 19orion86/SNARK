import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { proxyProtocolsRequest } from "@/lib/protocols/client"
import { apiErrorSchema } from "@/lib/validators/portal"

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const formData = await request.formData()
    formData.set("source", "web")
    formData.set("uploaded_by_user_id", auth.userId)

    const upstream = await proxyProtocolsRequest("/api/v1/protocols/upload", {
      method: "POST",
      body: formData,
    })

    if (!upstream.ok) {
      const body = await upstream.text()
      return NextResponse.json(
        apiErrorSchema.parse({
          error: "Не удалось загрузить файл для протокола",
          code: "PROTOCOLS_UPLOAD_FAILED",
          details: body.slice(0, 500),
        }),
        { status: upstream.status >= 500 ? 503 : upstream.status }
      )
    }

    const data = await upstream.json()
    await writeAuditLog({
      userId: auth.userId,
      action: "user:protocols:upload",
      resourceType: "meeting_protocols",
      resourceId: String(data.id ?? data.protocol_id ?? ""),
      statusCode: 201,
    })
    return NextResponse.json(data, { status: 201 })
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
