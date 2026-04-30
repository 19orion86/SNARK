import "server-only"
import type { PortalRepository } from "@/lib/repositories/portal-repository.types"
import { drizzlePortalRepository } from "@/lib/repositories/portal-repository.drizzle"
import { mockPortalRepository } from "@/lib/repositories/portal-repository.mock"

export function getPortalRepositoryServer(): PortalRepository {
  return process.env.USE_MOCK_DB === "false" ? drizzlePortalRepository : mockPortalRepository
}
