import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/chat/chat-page-content"
import { getServerSession } from "@/lib/auth/server-session"
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
  const data = await listMyChannels(session.userId)
  return <ChatPageContent initial={data} />
}
