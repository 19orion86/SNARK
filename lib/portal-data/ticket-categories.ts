import type { TicketCategoryItem, TicketCategoryUpsertPayload } from "@/types/portal"
import { TICKET_CATEGORY_LABEL } from "@/lib/portal-data/tickets-ui"

export function ticketCategoryLabel(
  slug: string,
  categories?: Array<Pick<TicketCategoryItem, "slug" | "label">>
): string {
  const fromList = categories?.find((item) => item.slug === slug)?.label
  if (fromList) return fromList
  return TICKET_CATEGORY_LABEL[slug as keyof typeof TICKET_CATEGORY_LABEL] ?? slug
}

export function slugifyTicketCategory(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32)
}

export const DEFAULT_TICKET_CATEGORIES: TicketCategoryUpsertPayload[] = [
  { slug: "it", label: "ИТ-поддержка", description: "Технические проблемы", sortOrder: 1, isActive: true },
  { slug: "aho", label: "АХО", description: "Офис и хозяйство", sortOrder: 2, isActive: true },
  { slug: "hr", label: "HR", description: "Кадровые вопросы", sortOrder: 3, isActive: true },
  { slug: "other", label: "Другое", description: "Прочие обращения", sortOrder: 4, isActive: true },
]
