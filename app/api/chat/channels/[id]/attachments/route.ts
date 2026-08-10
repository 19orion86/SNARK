import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { createAttachmentMessage } from "@/lib/repositories/chat-extras.repository"
import { saveChatFile } from "@/lib/storage/save-chat-file"
import { apiErrorSchema, chatMessageSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Выберите файл", code: "INVALID_PAYLOAD" }),
        { status: 400 }
      )
    }

    const saved = await saveChatFile(id, file)
    const { message, attachmentId } = await createAttachmentMessage(id, auth.userId, saved)

    await writeAuditLog({
      userId: auth.userId,
      action: "user:chat:attachment:create",
      resourceType: "chat_attachments",
      resourceId: attachmentId,
      statusCode: 201,
    })

    return NextResponse.json(
      { item: chatMessageSchema.parse(message), attachmentId },
      { status: 201 }
    )
  } catch (error) {
    const known = error as Partial<AuthError>
    const message = error instanceof Error ? error.message : "Не удалось загрузить файл"
    const status = known.status ?? (message.includes("доступ") ? 403 : 500)
    return NextResponse.json(
      apiErrorSchema.parse({
        error: status === 500 ? message : (known.message ?? message),
        code: status === 403 ? "FORBIDDEN" : status === 500 ? "INTERNAL_ERROR" : (known.code ?? "AUTH_ERROR"),
      }),
      { status }
    )
  }
}
