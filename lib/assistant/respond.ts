import "server-only"
import { NextResponse } from "next/server"
import { AssistantUnavailableError } from "@/lib/assistant/client"
import { AuthError } from "@/lib/auth/request-auth"
import { apiErrorSchema } from "@/lib/validators/portal"

/** Единый ответ об ошибке для маршрутов ассистента. */
export function assistantErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(apiErrorSchema.parse({ error: error.message, code: error.code }), {
      status: error.status,
    })
  }
  if (error instanceof AssistantUnavailableError) {
    return NextResponse.json(
      apiErrorSchema.parse({ error: error.message, code: "ASSISTANT_UNAVAILABLE" }),
      { status: 503 }
    )
  }
  return NextResponse.json(
    apiErrorSchema.parse({ error: "Внутренняя ошибка ассистента", code: "INTERNAL_ERROR" }),
    { status: 500 }
  )
}

export function invalidPayloadResponse(message = "Некорректные данные запроса"): NextResponse {
  return NextResponse.json(apiErrorSchema.parse({ error: message, code: "INVALID_PAYLOAD" }), {
    status: 400,
  })
}
