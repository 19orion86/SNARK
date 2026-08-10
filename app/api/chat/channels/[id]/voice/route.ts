import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { db } from "@/lib/db/client"
import { chatAttachments } from "@/lib/db/schema"
import { isMockDb } from "@/lib/config/mode"
import { sendMessage } from "@/lib/repositories/chat.repository"
import { saveChatVoiceFile } from "@/lib/storage/save-chat-voice"
import { apiErrorSchema, chatMessageSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const formData = await request.formData()
    const file = formData.get("audio")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Выберите аудиофайл", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const durationRaw = formData.get("duration")
    const duration =
      typeof durationRaw === "string" && durationRaw.trim()
        ? Number(durationRaw)
        : undefined

    const saved = await saveChatVoiceFile(id, file)
    const metadata: Record<string, unknown> = {
      fileUrl: saved.fileUrl,
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
    }
    if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
      metadata.duration = duration
    }

    const message = await sendMessage(id, auth.userId, "🎤 Голосовое сообщение", {
      messageType: "voice",
      metadata,
    })

    if (!isMockDb()) {
      await db.insert(chatAttachments).values({
        messageId: message.id,
        fileName: saved.fileName,
        fileUrl: saved.fileUrl,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        uploadedBy: auth.userId,
      })
    }

    await writeAuditLog({
      userId: auth.userId,
      action: "user:chat:voice:create",
      resourceType: "chat_messages",
      resourceId: message.id,
      statusCode: 201,
    })

    return NextResponse.json({ item: chatMessageSchema.parse(message) }, { status: 201 })
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось отправить голосовое"
    const status =
      known.status ??
      (message.includes("доступ")
        ? 403
        : message.includes("Поддерживаются") || message.includes("Размер")
          ? 400
          : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? message : (known.message ?? message),
        code:
          status === 403
            ? "FORBIDDEN"
            : status === 400
              ? "INVALID_PAYLOAD"
              : status === 500
                ? "INTERNAL_ERROR"
                : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
