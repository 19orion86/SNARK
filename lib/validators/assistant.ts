import { z } from "zod"

export const RAG_STATUSES = ["draft", "actual", "archived", "excluded"] as const
export type RagStatus = (typeof RAG_STATUSES)[number]

export const RAG_STATUS_LABELS: Record<RagStatus, string> = {
  draft: "Черновик",
  actual: "Актуален",
  archived: "В архиве",
  excluded: "Исключён",
}

export const assistantAskSchema = z.object({
  question: z.string().trim().min(1, "Введите вопрос").max(2000, "Вопрос слишком длинный"),
})

export const assistantFeedbackSchema = z.object({
  queryId: z.string().uuid(),
  value: z.union([z.literal(1), z.literal(-1)]),
})

export const ragStatusUpdateSchema = z.object({
  ragStatus: z.enum(RAG_STATUSES),
})

export const assistantSourceSchema = z.object({
  source_type: z.enum(["document", "article"]),
  source_id: z.string().uuid(),
  title: z.string(),
  version: z.string().nullable().optional(),
  section: z.string().default(""),
})

export const assistantAnswerSchema = z.object({
  query_id: z.string().uuid(),
  status: z.enum(["answered", "no_info", "contradiction"]),
  answer: z.string(),
  steps: z.array(z.string()).default([]),
  responsible: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  sources: z.array(assistantSourceSchema).default([]),
})

export type AssistantAnswer = z.infer<typeof assistantAnswerSchema>
export type AssistantSource = z.infer<typeof assistantSourceSchema>

export const assistantQueriesQuerySchema = z.object({
  status: z.enum(["answered", "no_info", "contradiction", "error"]).optional(),
  feedback: z.enum(["1", "-1"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
})

export interface AssistantQueryLogItem {
  id: string
  user_id: string
  userName?: string
  question: string
  status: "answered" | "no_info" | "contradiction" | "error"
  answer: string | null
  sources: AssistantSource[]
  llm_provider: string | null
  latency_ms: number | null
  error: string | null
  feedback: 1 | -1 | null
  created_at: string
}

export interface AssistantQueryLog {
  items: AssistantQueryLogItem[]
  total: number
  frequent: Array<{ question: string; total: number; last_asked_at: string }>
}

export interface RagDocumentItem {
  id: string
  title: string
  version: string
  fileName: string
  access: string
  ragStatus: RagStatus
  indexState: "pending" | "indexing" | "indexed" | "failed" | null
  indexError: string | null
  chunkCount: number
  indexedAt: string | null
}
