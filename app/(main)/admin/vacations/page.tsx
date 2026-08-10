import Link from "next/link"
import { redirect } from "next/navigation"
import { AdminVacationsTable } from "@/components/admin/admin-vacations-table"
import { Button } from "@/components/ui/button"
import { getServerSession } from "@/lib/auth/server-session"
import { loadAdminVacations } from "@/lib/portal-data/loaders"
import { listApprovalsForVacations } from "@/lib/repositories/vacation-approvals.repository"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Отпуска — Админ-панель",
}

export default async function AdminVacationsPage() {
  const session = await getServerSession()
  if (!session) {
    redirect("/login")
  }
  if (session.role !== "admin" && session.role !== "hr_manager") {
    redirect("/admin")
  }
  const items = await loadAdminVacations({ status: "pending" })
  const approvalsByVacation = await listApprovalsForVacations(items.map((item) => item.id))
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/vacations/calendar">
          <Button type="button" variant="outline">
            Календарь отпусков
          </Button>
        </Link>
      </div>
      <AdminVacationsTable initial={items} approvalsByVacation={approvalsByVacation} />
    </div>
  )
}
