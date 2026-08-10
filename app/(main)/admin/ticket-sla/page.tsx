import { redirect } from "next/navigation"
import { TicketSlaForm } from "@/components/admin/ticket-sla-form"
import { getServerSession } from "@/lib/auth/server-session"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "SLA поддержки — Админ-панель",
}

export default async function AdminTicketSlaPage() {
  const session = await getServerSession()
  if (!session) redirect("/login")
  if (session.role !== "admin" && session.role !== "hr_manager") redirect("/admin")
  return <TicketSlaForm />
}
