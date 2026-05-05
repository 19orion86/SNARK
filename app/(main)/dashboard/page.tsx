import { Dashboard } from "@/components/pages/dashboard"
import { loadDashboardData } from "@/lib/portal-data/loaders"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const data = await loadDashboardData()
  return <Dashboard data={data} />
}
