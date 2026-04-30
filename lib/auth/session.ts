import crypto from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { refreshTokens, users } from "@/lib/db/schema"

function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export function getRefreshTokenExpiryDate(): Date {
  const now = Date.now()
  return new Date(now + 7 * 24 * 60 * 60 * 1000)
}

export async function createSession(params: {
  userId: string
  refreshToken: string
  expiresAt?: Date
}) {
  const [session] = await db
    .insert(refreshTokens)
    .values({
      userId: params.userId,
      tokenHash: hashRefreshToken(params.refreshToken),
      expiresAt: params.expiresAt ?? getRefreshTokenExpiryDate(),
    })
    .returning()

  return session
}

export async function validateSession(refreshToken: string) {
  const now = new Date()
  const [session] = await db
    .select({
      id: refreshTokens.id,
      userId: refreshTokens.userId,
      expiresAt: refreshTokens.expiresAt,
      revokedAt: refreshTokens.revokedAt,
      user: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        departmentId: users.departmentId,
        isActive: users.isActive,
      },
    })
    .from(refreshTokens)
    .innerJoin(users, eq(refreshTokens.userId, users.id))
    .where(
      and(
        eq(refreshTokens.tokenHash, hashRefreshToken(refreshToken)),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, now)
      )
    )

  if (!session || !session.user.isActive) return null
  return session
}

export async function revokeSession(refreshToken: string) {
  const [revoked] = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(refreshToken)))
    .returning({ id: refreshTokens.id })

  return Boolean(revoked)
}

export async function rotateSession(params: {
  sessionId: string
  refreshToken: string
  expiresAt?: Date
}) {
  const [updated] = await db
    .update(refreshTokens)
    .set({
      tokenHash: hashRefreshToken(params.refreshToken),
      expiresAt: params.expiresAt ?? getRefreshTokenExpiryDate(),
      revokedAt: null,
    })
    .where(eq(refreshTokens.id, params.sessionId))
    .returning({ id: refreshTokens.id })

  return Boolean(updated)
}
