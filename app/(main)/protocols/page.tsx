import { redirect } from "next/navigation"
import { ProtocolsPageContent } from "@/components/protocols/protocols-page-content"
import { getServerSession } from "@/lib/auth/server-session"
import { proxyProtocolsRequest } from "@/lib/protocols/client"
import type { ProtocolListResponse } from "@/types/portal"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Протоколы совещаний",
}

export default async function ProtocolsPage() {
  const session = await getServerSession()
  if (!session) {
    redirect("/login")
  }

  let initial: ProtocolListResponse | null = null
  let serviceAvailable = false

  try {
    const upstream = await proxyProtocolsRequest("/api/v1/protocols/?limit=50")
    serviceAvailable = upstream.ok
    if (upstream.ok) {
      initial = (await upstream.json()) as ProtocolListResponse
    }
  } catch {
    serviceAvailable = false
  }

  return <ProtocolsPageContent initial={initial} serviceAvailable={serviceAvailable} />
}
