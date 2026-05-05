import { EmployeeDirectory } from "@/components/pages/employee-directory"
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
  const page = typeof pageRaw === "number" && Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : undefined
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined

  const data = await loadContactsData({ search, department, page, limit })
  return <EmployeeDirectory data={data} />
}
