import { NextResponse } from "next/server"
import { revokeSession } from "@/lib/auth/session"
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/tokens"

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { path: "/", maxAge: 0 })
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 })
}

export async function POST(request: Request) {
  try {
    const refreshToken = request.headers.get("cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${REFRESH_TOKEN_COOKIE}=`))
      ?.split("=")[1]

    if (refreshToken) {
      await revokeSession(refreshToken)
    }

    const response = NextResponse.json({ success: true })
    clearAuthCookies(response)
    return response
  } catch {
    const response = NextResponse.json({ success: true })
    clearAuthCookies(response)
    return response
  }
}
