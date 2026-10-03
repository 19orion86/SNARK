import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type AuthError } from "@/lib/auth/request-auth"
import { canViewDocument } from "@/lib/documents/access"
import { loadDocumentRequester } from "@/lib/documents/requester"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import { apiErrorSchema } from "@/lib/validators/portal"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = requireAuth(request)
    const { id } = await context.params
    const data = await getPortalRepositoryServer().getDocumentById(id)
    // Чужой документ неотличим от несуществующего: 404, а не 403.
    const allowed = data.item ? canViewDocument(await loadDocumentRequester(auth), data.item) : false
    if (!data.item || !data.item.fileUrl || !allowed) {
      const payload = apiErrorSchema.parse({
        error: "Документ не найден",
        code: "DOCUMENT_NOT_FOUND",
      })
      return NextResponse.json(payload, { status: 404 })
    }
    const { getFileStorage } = await import("@/lib/storage")
    const storage = getFileStorage()
    const previewUrl = await storage.getPreviewUrl(data.item.fileUrl)
    return NextResponse.redirect(previewUrl)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось открыть документ", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
