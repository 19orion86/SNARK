import { NextRequest, NextResponse } from "next/server"
import { assistantRequest } from "@/lib/assistant/client"
import { assistantErrorResponse } from "@/lib/assistant/respond"
import { requireRole } from "@/lib/auth/request-auth"
import { listRagDocuments } from "@/lib/repositories/assistant.repository"
import type { RagDocumentItem } from "@/lib/validators/assistant"

export const dynamic = "force-dynamic"

interface SourceState {
  source_id: string
  index_state: RagDocumentItem["indexState"]
  error: string | null
  chunk_count: number
  indexed_at: string | null
}

/** Документы портала + состояние их индексации в ассистенте. */
export async function GET(request: NextRequest) {
  try {
    requireRole(request, ["admin", "hr_manager"])
    const documents = await listRagDocuments()

    // Портал остаётся рабочим и без ассистента: статусы показываем, индекс помечаем недоступным.
    const states = new Map<string, SourceState>()
    let assistantAvailable = true
    try {
      const upstream = await assistantRequest("/sources?type=document")
      if (upstream.ok) {
        for (const state of (await upstream.json()) as SourceState[]) {
          states.set(state.source_id, state)
        }
      } else {
        assistantAvailable = false
      }
    } catch {
      assistantAvailable = false
    }

    const items: RagDocumentItem[] = documents.map((document) => {
      const state = states.get(document.id)
      return {
        ...document,
        indexState: state?.index_state ?? null,
        indexError: state?.error ?? null,
        chunkCount: state?.chunk_count ?? 0,
        indexedAt: state?.indexed_at ?? null,
      }
    })
    return NextResponse.json({ items, assistantAvailable })
  } catch (error) {
    return assistantErrorResponse(error)
  }
}
