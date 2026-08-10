import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { db } from "@/lib/db/client"
import { notificationPreferences } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { apiErrorSchema } from "@/lib/validators/portal"

const prefsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (isMockDb()) {
      return NextResponse.json({ item: { emailEnabled: true, inAppEnabled: true } })
    }
    const [row] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, auth.userId))
      .limit(1)
    return NextResponse.json({
      item: {
        emailEnabled: row?.emailEnabled ?? true,
        inAppEnabled: row?.inAppEnabled ?? true,
      },
    })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить настройки" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const parsed = prefsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Некорректные настройки", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }
    if (isMockDb()) {
      return NextResponse.json({
        item: {
          emailEnabled: parsed.data.emailEnabled ?? true,
          inAppEnabled: parsed.data.inAppEnabled ?? true,
        },
      })
    }

    const [existing] = await db
      .select({ id: notificationPreferences.id })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, auth.userId))
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(notificationPreferences)
        .set({
          emailEnabled: parsed.data.emailEnabled,
          inAppEnabled: parsed.data.inAppEnabled,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.userId, auth.userId))
        .returning()
      return NextResponse.json({
        item: { emailEnabled: row.emailEnabled, inAppEnabled: row.inAppEnabled },
      })
    }

    const [row] = await db
      .insert(notificationPreferences)
      .values({
        userId: auth.userId,
        emailEnabled: parsed.data.emailEnabled ?? true,
        inAppEnabled: parsed.data.inAppEnabled ?? true,
      })
      .returning()
    return NextResponse.json({
      item: { emailEnabled: row.emailEnabled, inAppEnabled: row.inAppEnabled },
    })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось сохранить настройки" : (known.message ?? "Ошибка"),
        code: status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
