import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { db } from "@/lib/db/client"
import { ticketAttachments, tickets } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { saveTaskFile } from "@/lib/storage/save-task-file"
import { apiErrorSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireAuth(request)
    const { id } = await context.params
    if (isMockDb()) return NextResponse.json({ items: [] })

    const [ticket] = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, id)).limit(1)
    if (!ticket) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Заявка не найдена", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }

    const rows = await db.select().from(ticketAttachments).where(eq(ticketAttachments.ticketId, id))
    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        fileUrl: row.fileUrl,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить вложения" : (known.message ?? "Ошибка"),
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
    if (isMockDb()) {
      return NextResponse.json({ item: { id: crypto.randomUUID(), fileName: "mock.bin" } }, { status: 201 })
    }

    const [ticket] = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, id)).limit(1)
    if (!ticket) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Заявка не найдена", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }

    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Файл обязателен", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    // Reuse task file storage path shape with ticket prefix via taskId slot
    const saved = await saveTaskFile(id, file, "general")

    const [row] = await db
      .insert(ticketAttachments)
      .values({
        ticketId: id,
        fileName: saved.fileName,
        fileUrl: saved.fileUrl,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        uploadedBy: auth.userId,
      })
      .returning()

    return NextResponse.json(
      {
        item: {
          id: row.id,
          fileName: row.fileName,
          fileUrl: row.fileUrl,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          createdAt: row.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Ошибка"
    const status = known.status ?? (message.includes("тип") || message.includes("размер") ? 400 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? "Не удалось загрузить файл" : message,
        code: status === 400 ? "INVALID_PAYLOAD" : status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
