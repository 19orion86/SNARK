import { redirect } from "next/navigation"
import { AdminTicketCategoriesTable } from "@/components/admin/admin-ticket-categories-table"
import { getServerSession } from "@/lib/auth/server-session"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Категории поддержки — Админ-панель",
}

export default async function AdminSupportCategoriesPage() {
  const session = await getServerSession()
  if (!session) {
    redirect("/login")
  }
  if (session.role !== "admin" && session.role !== "hr_manager") {
    redirect("/admin")
  }

  const data = await getPortalRepositoryServer().listTicketCategories(false)
  return <AdminTicketCategoriesTable initial={data} />
}
