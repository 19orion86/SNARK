import { Suspense } from "react"
import { redirect } from "next/navigation"
import { EmployeeDirectory } from "@/components/pages/employee-directory"
import { getServerSession } from "@/lib/auth/server-session"
import { loadContactsData } from "@/lib/portal-data/loaders"

export const dynamic = "force-dynamic"

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const search = typeof params.search === "string" ? params.search : undefined
  const department = typeof params.department === "string" ? params.department : undefined
  const pageRaw = typeof params.page === "string" ? Number(params.page) : undefined
  const limitRaw = typeof params.limit === "string" ? Number(params.limit) : undefined
  const page = typeof pageRaw === "number" && Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20

  const session = await getServerSession()
  if (!session) {
    redirect("/login")
  }

  const data = await loadContactsData({ search, department, page, limit })
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Загрузка справочника...</div>}>
      <EmployeeDirectory data={data} currentUserId={session.userId} />
    </Suspense>
  )
}
