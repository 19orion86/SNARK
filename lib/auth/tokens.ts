import jwt, { type JwtPayload } from "jsonwebtoken"
import type { UserRole } from "@/types/auth"

export const ACCESS_TOKEN_COOKIE = "access_token"
export const REFRESH_TOKEN_COOKIE = "refresh_token"
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
let cookieConfigWarningShown = false

type CookieSameSite = "lax" | "strict"

export interface AuthCookieConfig {
  httpOnly: true
  secure: boolean
  sameSite: CookieSameSite
  path: "/"
  maxAge: number
}

export interface AccessTokenPayload extends JwtPayload {
  userId: string
  email: string
  role: UserRole
}

export interface RefreshTokenPayload extends JwtPayload {
  userId: string
}

function getExpectedCookiePolicy() {
  if (process.env.NODE_ENV === "production") {
    return { secure: true, sameSite: "strict" as CookieSameSite, httpOnly: true as const }
  }

  return { secure: false, sameSite: "lax" as CookieSameSite, httpOnly: true as const }
}

export function validateCookieConfig(maxAge: number): AuthCookieConfig {
  const expected = getExpectedCookiePolicy()
  const config: AuthCookieConfig = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
    maxAge,
  }

  const isUnsafe =
    config.httpOnly !== expected.httpOnly ||
    config.secure !== expected.secure ||
    config.sameSite !== expected.sameSite

  if (isUnsafe && !cookieConfigWarningShown) {
    cookieConfigWarningShown = true
    console.warn(
      `[auth] Небезопасная cookie-конфигурация: expected secure=${expected.secure}, sameSite=${expected.sameSite}, httpOnly=${expected.httpOnly}; got secure=${config.secure}, sameSite=${config.sameSite}, httpOnly=${config.httpOnly}`
    )
  }

  return config
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
