import { redirect } from "next/navigation"
import { AssistantChat } from "@/components/assistant/assistant-chat"
import { getServerSession } from "@/lib/auth/server-session"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Ассистент",
}

export default async function AssistantPage() {
  const session = await getServerSession()
  if (!session) redirect("/login")
  return (
    <div className="h-full">
      <AssistantChat />
    </div>
  )
}
