import { redirect } from "next/navigation"
import { SupportPageContent } from "@/components/support/support-page-content"
import { getServerSession } from "@/lib/auth/server-session"
import { loadMyTickets, loadTicketCategories } from "@/lib/portal-data/loaders"
import type { TicketCategory } from "@/types/portal"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Поддержка",
}

interface SupportPageProps {
  searchParams: Promise<{ category?: string }>
}

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const session = await getServerSession()
  if (!session) {
    redirect("/login")
  }
  const params = await searchParams
  const [data, categoriesData] = await Promise.all([
    loadMyTickets(session.userId, { page: 1, limit: 20 }),
    loadTicketCategories(true),
  ])
  const slugs = new Set(categoriesData.items.map((item) => item.slug))
  const categoryParam = params.category
  const defaultCategory =
    categoryParam && slugs.has(categoryParam) ? (categoryParam as TicketCategory) : undefined

  return (
    <SupportPageContent
      initial={data}
      categories={categoriesData.items}
      defaultCategory={defaultCategory}
    />
  )
}
