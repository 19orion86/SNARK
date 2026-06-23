import { redirect } from "next/navigation"
import { AdminTicketsTable } from "@/components/admin/admin-tickets-table"
import { getServerSession } from "@/lib/auth/server-session"
import { loadAdminTickets, loadTicketCategories } from "@/lib/portal-data/loaders"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Заявки — Админ-панель",
}

export default async function AdminTicketsPage() {
  const session = await getServerSession()
  if (!session) {
    redirect("/login")
  }
  if (session.role !== "admin") {
    redirect("/admin")
  }
  const [data, categories] = await Promise.all([
    loadAdminTickets({ page: 1, limit: 50 }),
    loadTicketCategories(false),
  ])
  return (
    <AdminTicketsTable
      initial={data}
      categories={categories.items}
      currentAdminId={session.userId}
    />
  )
}
