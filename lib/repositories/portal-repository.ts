import type { PortalRepository } from "@/lib/repositories/portal-repository.types"
import { mockPortalRepository } from "@/lib/repositories/portal-repository.mock"

export type { PortalRepository } from "@/lib/repositories/portal-repository.types"

// Client-safe fallback repository.
export function getPortalRepository(): PortalRepository {
  return mockPortalRepository
}
