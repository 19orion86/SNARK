import { NextRequest, NextResponse } from "next/server"
import type { Session, UserRole } from "@/types/auth"
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  type AccessTokenPayload,
  verifyToken,
} from "@/lib/auth/tokens"

const PUBLIC_PATHS = ["/", "/login"]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (pathname.startsWith("/api/auth/")) return true
  if (pathname.startsWith("/_next/")) return true
  if (pathname.startsWith("/static/")) return true
  if (pathname === "/favicon.ico") return true
  return false
}

function extractAccessToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization")
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length)
  }
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin")
}

function isPrivilegedRole(role: UserRole): boolean {
  return role === "admin" || role === "hr_manager"
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url)
  return NextResponse.redirect(loginUrl)
}

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "Недостаточно прав доступа" }, { status: 403 })
}

function attachSessionHeaders(request: NextRequest, payload: Session): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-user-id", payload.userId)
  requestHeaders.set("x-user-role", payload.role)
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

async function tryRefresh(request: NextRequest): Promise<{
  payload: Session | null
  setCookie: string | null
}> {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  if (!refreshToken) return { payload: null, setCookie: null }

  const refreshResponse = await fetch(new URL("/api/auth/refresh", request.url), {
    method: "POST",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
      "content-type": "application/json",
    },
  })

  if (!refreshResponse.ok) {
    return { payload: null, setCookie: null }
  }

  const responseBody = (await refreshResponse.json()) as {
    accessToken?: string
    user?: { role?: UserRole }
  }

  if (!responseBody.accessToken) {
    return { payload: null, setCookie: null }
  }

  const decoded = verifyToken<AccessTokenPayload>(responseBody.accessToken, "access")
  const payload: Session = {
    userId: decoded.userId,
    role: decoded.role,
    iat: decoded.iat ?? 0,
    exp: decoded.exp ?? 0,
  }

  return {
    payload,
    setCookie: refreshResponse.headers.get("set-cookie"),
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const accessToken = extractAccessToken(request)
  let payload: Session | null = null
  let propagatedSetCookie: string | null = null

  if (accessToken) {
    try {
      const verified = verifyToken<AccessTokenPayload>(accessToken, "access")
      payload = {
        userId: verified.userId,
        role: verified.role,
        iat: verified.iat ?? 0,
        exp: verified.exp ?? 0,
      }
    } catch {
      const refreshed = await tryRefresh(request)
      payload = refreshed.payload
      propagatedSetCookie = refreshed.setCookie
    }
  } else {
    const refreshed = await tryRefresh(request)
    payload = refreshed.payload
    propagatedSetCookie = refreshed.setCookie
  }

  if (!payload) {
    return redirectToLogin(request)
  }

  if (isAdminRoute(pathname) && !isPrivilegedRole(payload.role)) {
    return forbiddenResponse()
  }

  const response = attachSessionHeaders(request, payload)
  if (propagatedSetCookie) {
    response.headers.set("set-cookie", propagatedSetCookie)
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
