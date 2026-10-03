"use client"

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  FileText,
  ListChecks,
  Send,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { AssistantAnswer, AssistantSource } from "@/lib/validators/assistant"

type Turn =
  | { id: string; kind: "question"; text: string }
  | { id: string; kind: "answer"; answer: AssistantAnswer; feedback: 1 | -1 | null }
  | { id: string; kind: "error"; text: string }

const EXAMPLES = [
  "Сколько длится испытательный срок?",
  "Как назначается наставник новому сотруднику?",
  "Кто согласует обучение за счёт компании?",
]

function sourceHref(source: AssistantSource): string {
  return source.source_type === "article"
    ? `/knowledge/${source.source_id}`
    : `/documents?search=${encodeURIComponent(source.title)}`
}

function SourceList({ sources }: { sources: AssistantSource[] }) {
  if (sources.length === 0) return null
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Источники</p>
      <ul className="space-y-1.5">
        {sources.map((source) => (
          <li key={`${source.source_id}-${source.section}`}>
            <Link
              href={sourceHref(source)}
              className="inline-flex items-start gap-2 rounded-md text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="assistant-source"
            >
              <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {source.title}
                {source.version ? `, версия ${source.version}` : ""}
                {source.section ? ` — раздел ${source.section}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AnswerCard({
  turn,
  onFeedback,
}: {
  turn: Extract<Turn, { kind: "answer" }>
  onFeedback: (value: 1 | -1) => void
}) {
  const { answer } = turn
  const isNoInfo = answer.status === "no_info"
  const isContradiction = answer.status === "contradiction"

  return (
    <Card
      className={cn("max-w-3xl p-4", isNoInfo && "border-dashed bg-muted/40")}
      data-testid="assistant-answer"
      data-status={answer.status}
    >
      {isNoInfo && (
        <Badge variant="secondary" className="mb-2">
          В базе знаний нет ответа
        </Badge>
      )}
      {isContradiction && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Документы противоречат друг другу. Уточните у отдела кадров, какой из них действует.</span>
        </div>
      )}

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-card-foreground">{answer.answer}</p>

      {answer.steps.length > 0 && (
        <section className="mt-4" aria-label="Что сделать">
          <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4" aria-hidden="true" />
            Что сделать
          </h3>
          <ol className="list-decimal space-y-1 pl-6 text-sm">
            {answer.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      {(answer.responsible || answer.deadline) && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {answer.responsible && (
            <div className="flex items-start gap-2">
              <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="text-xs text-muted-foreground">Ответственный</dt>
                <dd>{answer.responsible}</dd>
              </div>
            </div>
          )}
          {answer.deadline && (
            <div className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="text-xs text-muted-foreground">Срок</dt>
                <dd>{answer.deadline}</dd>
              </div>
            </div>
          )}
        </dl>
      )}

      <SourceList sources={answer.sources} />

      <div className="mt-3 flex items-center gap-1">
        <span className="mr-1 text-xs text-muted-foreground">Ответ помог?</span>
        <Button
          type="button"
          size="icon"
          variant={turn.feedback === 1 ? "default" : "ghost"}
          className="size-8"
          aria-label="Ответ полезен"
          aria-pressed={turn.feedback === 1}
          onClick={() => onFeedback(1)}
        >
          <ThumbsUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={turn.feedback === -1 ? "default" : "ghost"}
          className="size-8"
          aria-label="Ответ не помог"
          aria-pressed={turn.feedback === -1}
          onClick={() => onFeedback(-1)}
        >
          <ThumbsDown className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  )
}

export function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState("")
  const [pending, setPending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns, pending])

  const ask = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || pending) return
    setTurns((prev) => [...prev, { id: crypto.randomUUID(), kind: "question", text: trimmed }])
    setQuestion("")
    setPending(true)
    try {
      const response = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "Сервис ассистента недоступен")
      }
      const answer = (await response.json()) as AssistantAnswer
      setTurns((prev) => [...prev, { id: answer.query_id, kind: "answer", answer, feedback: null }])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Сервис ассистента недоступен"
      setTurns((prev) => [...prev, { id: crypto.randomUUID(), kind: "error", text: message }])
    } finally {
      setPending(false)
    }
  }

  const sendFeedback = async (queryId: string, value: 1 | -1) => {
    setTurns((prev) =>
      prev.map((turn) => (turn.kind === "answer" && turn.id === queryId ? { ...turn, feedback: value } : turn))
    )
    const response = await fetch("/api/assistant/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ queryId, value }),
    }).catch(() => null)
    if (!response?.ok) {
      setTurns((prev) =>
        prev.map((turn) => (turn.kind === "answer" && turn.id === queryId ? { ...turn, feedback: null } : turn))
      )
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void ask(question)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void ask(question)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Ассистент по базе знаний</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Отвечает только по документам портала и всегда указывает источник. Если ответа в документах нет —
          так и скажет.
        </p>
      </header>

      <div
        className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border bg-card/40 p-4"
        aria-live="polite"
        aria-busy={pending}
      >
        {turns.length === 0 && !pending && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
            <Bot className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Задайте вопрос по регламентам компании, например:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((example) => (
                <Button key={example} type="button" variant="outline" size="sm" onClick={() => void ask(example)}>
                  {example}
                </Button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) => {
          if (turn.kind === "question") {
            return (
              <div key={turn.id} className="flex justify-end">
                <p className="max-w-2xl whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                  {turn.text}
                </p>
              </div>
            )
          }
          if (turn.kind === "error") {
            return (
              <div
                key={turn.id}
                role="alert"
                data-testid="assistant-error"
                className="flex max-w-3xl items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{turn.text}</span>
              </div>
            )
          }
          return <AnswerCard key={turn.id} turn={turn} onFeedback={(value) => void sendFeedback(turn.id, value)} />
        })}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="assistant-loading">
            <Spinner className="size-4" />
            Ищу ответ в документах…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex items-end gap-2">
        <label htmlFor="assistant-question" className="sr-only">
          Вопрос ассистенту
        </label>
        <Textarea
          id="assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Напишите вопрос. Enter — отправить, Shift+Enter — новая строка"
          rows={2}
          maxLength={2000}
          disabled={pending}
          className="min-h-[3.25rem] resize-none"
        />
        <Button type="submit" disabled={pending || question.trim().length === 0} aria-label="Отправить вопрос">
          <Send className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Спросить</span>
        </Button>
      </form>
    </div>
  )
}
