import { redirect } from "next/navigation"
import { Suspense } from "react"
import { ChatPageContent } from "@/components/chat/chat-page-content"
import { getServerSession } from "@/lib/auth/server-session"
import { loadContactsData } from "@/lib/portal-data/loaders"
import { listMyChannels } from "@/lib/repositories/chat.repository"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Чат",
}

export default async function ChatPage() {
  const session = await getServerSession()
  if (!session) {
    redirect("/login")
  }

  const [data, contacts] = await Promise.all([
    listMyChannels(session.userId),
    loadContactsData({ limit: 200 }),
  ])

  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Загрузка чата...</p>}>
      <ChatPageContent
        initial={data}
        employees={contacts.employees}
        currentUserId={session.userId}
      />
    </Suspense>
  )
}
