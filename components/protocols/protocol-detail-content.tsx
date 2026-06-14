"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ProtocolDetail } from "@/types/portal"

interface ProtocolDetailContentProps {
  item: ProtocolDetail
}

export function ProtocolDetailContent({ item }: ProtocolDetailContentProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{item.title}</h1>
          <p className="text-sm text-muted-foreground">
            {item.meetingDate} · {item.participants.join(", ")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/protocols">Назад</Link>
          </Button>
          {item.status === "completed" ? (
            <Button asChild>
              <a href={`/api/protocols/${item.id}/export-docx`}>Скачать DOCX</a>
            </Button>
          ) : null}
        </div>
      </div>

      {item.errorMessage ? (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {item.errorMessage}
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Протокол</h2>
        <pre className="mt-4 whitespace-pre-wrap text-sm">{item.protocolText ?? "Ещё формируется..."}</pre>
      </Card>

      {item.transcriptText ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Транскрипт</h2>
          <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap text-sm">
            {item.transcriptText}
          </pre>
        </Card>
      ) : null}

      {item.actionItems.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Поручения</h2>
          <ul className="mt-4 space-y-3">
            {item.actionItems.map((actionItem) => (
              <li key={actionItem.id} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{actionItem.text}</div>
                <div className="mt-1 text-muted-foreground">
                  {actionItem.assignee}
                  {actionItem.deadline ? ` · до ${actionItem.deadline}` : ""}
                  {` · ${actionItem.status}`}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
