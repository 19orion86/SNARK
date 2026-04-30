import { headers } from "next/headers"
import { Documents } from "@/components/pages/documents"
import { loadDocumentsData } from "@/lib/portal-data/loaders"

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const category = typeof params.category === "string" ? params.category : undefined
  const search = typeof params.search === "string" ? params.search : undefined
  const pageRaw = typeof params.page === "string" ? Number(params.page) : undefined
  const limitRaw = typeof params.limit === "string" ? Number(params.limit) : undefined
  const page = typeof pageRaw === "number" && Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : undefined
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined

  const requestHeaders = await headers()
  const role = requestHeaders.get("x-user-role") ?? "employee"
  const userId = requestHeaders.get("x-user-id") ?? undefined
  const departmentId = requestHeaders.get("x-user-department") ?? undefined

  const data = await loadDocumentsData({ category, search, page, limit }, { role, userId, departmentId })
  return <Documents data={data} />
}
