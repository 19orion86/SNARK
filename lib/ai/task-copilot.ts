import "server-only"

export interface TaskSuggestInput {
  title?: string
  description?: string
  mode: "formulate" | "checklist" | "due_hint" | "chat_summary"
  messages?: Array<{ authorName?: string; body: string }>
}

export interface TaskSuggestResult {
  title?: string
  description?: string
  checklist?: string[]
  dueDateHint?: string
  summary?: string
  source: "llm" | "heuristic"
}

function heuristicChecklist(description: string): string[] {
  const lines = description
    .split(/\n|[.;]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && s.length <= 200)
  const items = lines.slice(0, 10)
  if (items.length >= 3) return items.map((s) => s.replace(/^[-*•\d.)\s]+/, "").slice(0, 200))
  const base = description.trim().slice(0, 120) || "Выполнить задачу"
  return [
    `Уточнить требования: ${base}`,
    "Согласовать с заинтересованными сторонами",
    "Подготовить результат и зафиксировать статус",
    "Отправить на проверку постановщику",
  ]
}

function heuristicFormulate(input: TaskSuggestInput): TaskSuggestResult {
  const raw = (input.description || input.title || "").trim()
  const title =
    input.title?.trim() ||
    raw.split(/[.!\n]/)[0]?.trim().slice(0, 120) ||
    "Новая задача"
  const description =
    input.description?.trim() ||
    (raw ? `Цель: ${raw}\n\nОжидаемый результат: описать и сдать постановщику.` : null)
  return {
    title,
    description: description ?? undefined,
    checklist: heuristicChecklist(description || title),
    dueDateHint: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    source: "heuristic",
  }
}

function heuristicSummary(messages: Array<{ authorName?: string; body: string }>): string {
  const recent = messages.slice(-30)
  if (recent.length === 0) return "В чате пока нет сообщений для саммари."
  const bullets = recent
    .filter((m) => m.body && !m.body.startsWith("Системное:"))
    .slice(-8)
    .map((m) => `• ${m.authorName ?? "Участник"}: ${m.body.slice(0, 140)}`)
  return `Краткое резюме обсуждения (${recent.length} сообщ.):\n${bullets.join("\n")}`
}

async function callOpenAiCompatible(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY
  const baseUrl = (process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  )
  const model = process.env.OPENAI_MODEL || process.env.LLM_MODEL || "gpt-4o-mini"
  if (!apiKey) return null

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Ты CoPilot корпоративного портала SNARK. Отвечай строго JSON без markdown.",
        },
        { role: "user", content: prompt },
      ],
    }),
  })
  if (!response.ok) return null
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content?.trim() ?? null
}

export async function suggestTask(input: TaskSuggestInput): Promise<TaskSuggestResult> {
  if (input.mode === "chat_summary") {
    const prompt = `Сделай краткое саммари чата задачи на русском (до 8 пунктов). Верни JSON {"summary":"..."}.\n\n${JSON.stringify(input.messages ?? []).slice(0, 12000)}`
    const raw = await callOpenAiCompatible(prompt)
    if (raw) {
      try {
        const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as { summary?: string }
        if (parsed.summary) return { summary: parsed.summary, source: "llm" }
      } catch {
        return { summary: raw.slice(0, 2000), source: "llm" }
      }
    }
    return { summary: heuristicSummary(input.messages ?? []), source: "heuristic" }
  }

  if (input.mode === "checklist") {
    const prompt = `Сгенерируй чек-лист 3-10 пунктов по задаче. JSON {"checklist":["..."]}.\nTitle: ${input.title ?? ""}\nDescription: ${input.description ?? ""}`
    const raw = await callOpenAiCompatible(prompt)
    if (raw) {
      try {
        const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as { checklist?: string[] }
        if (parsed.checklist && parsed.checklist.length >= 3) {
          return { checklist: parsed.checklist.slice(0, 10), source: "llm" }
        }
      } catch {
        // fall through
      }
    }
    return {
      checklist: heuristicChecklist(input.description || input.title || ""),
      source: "heuristic",
    }
  }

  const prompt = `Сформулируй задачу. JSON {"title":"...","description":"...","checklist":["..."],"dueDateHint":"YYYY-MM-DD"}.\nTitle: ${input.title ?? ""}\nDescription: ${input.description ?? ""}`
  const raw = await callOpenAiCompatible(prompt)
  if (raw) {
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as TaskSuggestResult
      return {
        title: parsed.title,
        description: parsed.description,
        checklist: parsed.checklist?.slice(0, 10),
        dueDateHint: parsed.dueDateHint,
        source: "llm",
      }
    } catch {
      // fall through
    }
  }
  return heuristicFormulate(input)
}
