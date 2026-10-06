import { redirect } from "next/navigation"
import { AssistantAdmin } from "@/components/admin/assistant-admin"
import { getServerSession } from "@/lib/auth/server-session"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Ассистент — Админ-панель",
}

export default async function AdminAssistantPage() {
  const session = await getServerSession()
  if (!session) redirect("/login")
  if (session.role !== "admin" && session.role !== "hr_manager") redirect("/dashboard")
  return <AssistantAdmin />
}
