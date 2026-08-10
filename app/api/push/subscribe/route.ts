import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import {
  deletePushSubscription,
  upsertPushSubscription,
} from "@/lib/push/web-push"
import {
  apiErrorSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} from "@/lib/validators/portal"

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const body = await request.json()
    const parsed = pushSubscribeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректная подписка", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    await upsertPushSubscription({
      userId: auth.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: request.headers.get("user-agent"),
    })

    await writeAuditLog({
      userId: auth.userId,
      action: "user:push:subscribe",
      resourceType: "push_subscriptions",
      statusCode: 200,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось сохранить подписку" : (known.message ?? "Ошибка"),
        code: known.code ?? (status === 500 ? "INTERNAL_ERROR" : "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const body = await request.json()
    const parsed = pushUnsubscribeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректный endpoint", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    await deletePushSubscription(parsed.data.endpoint, auth.userId)
    await writeAuditLog({
      userId: auth.userId,
      action: "user:push:unsubscribe",
      resourceType: "push_subscriptions",
      statusCode: 200,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось удалить подписку" : (known.message ?? "Ошибка"),
        code: known.code ?? (status === 500 ? "INTERNAL_ERROR" : "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
