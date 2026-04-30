import { NextResponse } from "next/server"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  type AccessTokenPayload,
  generateAccessToken,
  generateRefreshToken,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  validateCookieConfig,
  verifyToken,
  type RefreshTokenPayload,
} from "@/lib/auth/tokens"
import { getRefreshTokenExpiryDate, rotateSession, validateSession } from "@/lib/auth/session"

function unauthorizedResponse() {
  const response = NextResponse.json({ error: "Сессия недействительна" }, { status: 401 })
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { path: "/", maxAge: 0 })
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 })
  return response
}

export async function POST(request: Request) {
  try {
    const refreshToken = request.headers.get("cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${REFRESH_TOKEN_COOKIE}=`))
      ?.split("=")[1]

    if (!refreshToken) {
      return unauthorizedResponse()
    }

    let decodedRefresh: RefreshTokenPayload
    try {
      decodedRefresh = verifyToken<RefreshTokenPayload>(refreshToken, "refresh")
    } catch {
      return unauthorizedResponse()
    }

    const session = await validateSession(refreshToken)
    if (!session || session.user.id !== decodedRefresh.userId) {
      return unauthorizedResponse()
    }

    const accessPayload: Pick<AccessTokenPayload, "userId" | "email" | "role"> = {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
    }

    const nextAccessToken = generateAccessToken(accessPayload)
    const nextRefreshToken = generateRefreshToken({ userId: session.user.id })
    const nextRefreshExpiresAt = getRefreshTokenExpiryDate()

    await rotateSession({
      sessionId: session.id,
      refreshToken: nextRefreshToken,
      expiresAt: nextRefreshExpiresAt,
    })

    const response = NextResponse.json({
      accessToken: nextAccessToken,
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
        departmentId: session.user.departmentId,
        isActive: session.user.isActive,
      },
    })

    response.cookies.set(
      REFRESH_TOKEN_COOKIE,
      nextRefreshToken,
      validateCookieConfig(REFRESH_TOKEN_TTL_SECONDS)
    )
    response.cookies.set(
      ACCESS_TOKEN_COOKIE,
      nextAccessToken,
      validateCookieConfig(ACCESS_TOKEN_TTL_SECONDS)
    )

    return response
  } catch {
    return unauthorizedResponse()
  }
}
