import { notFound, redirect } from "next/navigation"
import { ProtocolDetailContent } from "@/components/protocols/protocol-detail-content"
import { getServerSession } from "@/lib/auth/server-session"
import { proxyProtocolsRequest } from "@/lib/protocols/client"
import type { ProtocolDetail } from "@/types/portal"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProtocolDetailPage({ params }: PageProps) {
  const session = await getServerSession()
  if (!session) {
    redirect("/login")
  }

  const { id } = await params
  const upstream = await proxyProtocolsRequest(`/api/v1/protocols/${id}`)
  if (!upstream.ok) {
    notFound()
  }

  const raw = await upstream.json()
  const item: ProtocolDetail = {
    id: raw.id,
    title: raw.title,
    meetingDate: raw.meeting_date ?? raw.meetingDate,
    participants: raw.participants ?? [],
    status: raw.status,
    source: raw.source ?? "web",
    createdAt: raw.created_at ?? raw.createdAt,
    protocolText: raw.protocol_text ?? raw.protocolText ?? null,
    transcriptText: raw.transcript_text ?? raw.transcriptText ?? null,
    agenda: raw.agenda ?? [],
    decisions: raw.decisions ?? [],
    actionItems: (raw.action_items ?? raw.actionItems ?? []).map(
      (actionItem: Record<string, unknown>) => ({
        id: actionItem.id as number,
        text: actionItem.text as string,
        assignee: actionItem.assignee as string,
        deadline: (actionItem.deadline as string | null) ?? null,
        status: actionItem.status as string,
        priority: actionItem.priority as string,
      })
    ),
    errorMessage: raw.error_message ?? raw.errorMessage ?? null,
  }

  return <ProtocolDetailContent item={item} />
}
