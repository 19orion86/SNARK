import type { NextRequest } from "next/server"
import type { AccessTokenPayload } from "@/lib/auth/tokens"
import { ACCESS_TOKEN_COOKIE, verifyToken } from "@/lib/auth/tokens"
import type { UserRole } from "@/types/auth"

export interface RequestAuthContext {
  userId: string
  role: UserRole
  email: string
}

export class AuthError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function extractAccessToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization")
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length)
  }
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null
}

export function requireAuth(request: NextRequest): RequestAuthContext {
  const token = extractAccessToken(request)
  if (!token) {
    throw new AuthError("Требуется авторизация", 401, "UNAUTHORIZED")
  }

  try {
    const payload = verifyToken<AccessTokenPayload>(token, "access")
    return {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
    }
  } catch {
    throw new AuthError("Недействительный токен доступа", 401, "INVALID_TOKEN")
  }
}

export function requireRole(request: NextRequest, allowedRoles: UserRole[]): RequestAuthContext {
  const auth = requireAuth(request)
  if (!allowedRoles.includes(auth.role)) {
    throw new AuthError("Недостаточно прав доступа", 403, "FORBIDDEN")
  }
  return auth
}
