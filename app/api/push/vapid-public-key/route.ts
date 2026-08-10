import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { getVapidPublicKey } from "@/lib/push/web-push"
import { apiErrorSchema } from "@/lib/validators/portal"

export async function GET(request: NextRequest) {
  try {
    requireAuth(request)
    const publicKey = getVapidPublicKey()
    return NextResponse.json({ publicKey })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: known.message ?? "Ошибка авторизации",
        code: known.code ?? (status === 500 ? "INTERNAL_ERROR" : "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
