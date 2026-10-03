import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Profile } from "@/components/pages/profile"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const requestHeaders = await headers()
  const userId = requestHeaders.get("x-user-id")
  if (!userId) redirect("/login")

  const data = await getPortalRepositoryServer().getCurrentUserProfile(userId)
  if (!data) redirect("/login")

  return <Profile data={data} />
}
