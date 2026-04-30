import jwt, { type JwtPayload } from "jsonwebtoken"
import type { UserRole } from "@/types/auth"

export const ACCESS_TOKEN_COOKIE = "access_token"
export const REFRESH_TOKEN_COOKIE = "refresh_token"
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

export interface AccessTokenPayload extends JwtPayload {
  userId: string
  email: string
  role: UserRole
}

export interface RefreshTokenPayload extends JwtPayload {
  userId: string
}

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not set")
  }
  return secret
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not set")
  }
  return secret
}

export function generateAccessToken(payload: {
  userId: string
  email: string
  role: UserRole
}): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: ACCESS_TOKEN_TTL_SECONDS })
}

export function generateRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: REFRESH_TOKEN_TTL_SECONDS })
}

export function verifyToken<T extends JwtPayload>(
  token: string,
  tokenType: "access" | "refresh"
): T {
  const secret = tokenType === "access" ? getAccessSecret() : getRefreshSecret()
  return jwt.verify(token, secret) as T
}
