import { headers } from "next/headers"
import { Profile } from "@/components/pages/profile"
import { loadProfileData } from "@/lib/portal-data/loaders"

export default async function ProfilePage() {
  const requestHeaders = await headers()
  const userId = requestHeaders.get("x-user-id") ?? undefined
  const data = await loadProfileData(userId)
  return <Profile data={data} />
}
