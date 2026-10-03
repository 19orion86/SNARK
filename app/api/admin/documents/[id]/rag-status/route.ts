import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requestReindex } from "@/lib/assistant/client"
import { assistantErrorResponse, invalidPayloadResponse } from "@/lib/assistant/respond"
import { writeAuditLog } from "@/lib/audit/log"
import { requireRole } from "@/lib/auth/request-auth"
import { updateDocumentRagStatus } from "@/lib/repositories/assistant.repository"
import { ragStatusUpdateSchema } from "@/lib/validators/assistant"
import { apiErrorSchema } from "@/lib/validators/portal"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

const idSchema = z.string().uuid()

/**
 * Публикация документа для ассистента: смена rag_status и постановка на индексацию.
 * `actual` — индексируется; `draft`, `archived`, `excluded` — чанки удаляются.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const { id } = await context.params
    const parsedId = idSchema.safeParse(id)
    const parsed = ragStatusUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsedId.success || !parsed.success) return invalidPayloadResponse()

    const updated = await updateDocumentRagStatus(parsedId.data, parsed.data.ragStatus)
    if (!updated) {
      return NextResponse.json(
        apiErrorSchema.parse({ error: "Документ не найден", code: "NOT_FOUND" }),
        { status: 404 }
      )
    }

    const queued = await requestReindex("document", parsedId.data)
    await writeAuditLog({
      userId: auth.userId,
      action: "documents:rag_status",
      resourceType: "documents",
      resourceId: parsedId.data,
      statusCode: 200,
      metadata: JSON.stringify({ ragStatus: parsed.data.ragStatus, queued }),
    })
    return NextResponse.json({ id: parsedId.data, ragStatus: parsed.data.ragStatus, queued })
  } catch (error) {
    return assistantErrorResponse(error)
  }
}
