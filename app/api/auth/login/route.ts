import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { verifyPassword } from "@/lib/auth/password"
import { createSession, getRefreshTokenExpiryDate } from "@/lib/auth/session"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  type AccessTokenPayload,
  generateAccessToken,
  generateRefreshToken,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/lib/auth/tokens"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { loginSchema } from "@/lib/validators/auth"

const INVALID_CREDENTIALS_MESSAGE = "Неверный email или пароль"

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = loginSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Проверьте корректность введенных данных" },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        departmentId: users.departmentId,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, email))

    if (!user) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 })
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Аккаунт деактивирован" }, { status: 403 })
    }

    const accessPayload: Pick<AccessTokenPayload, "userId" | "email" | "role"> = {
      userId: user.id,
      email: user.email,
      role: user.role,
    }

    const accessToken = generateAccessToken(accessPayload)
    const refreshToken = generateRefreshToken({ userId: user.id })
    const refreshExpiresAt = getRefreshTokenExpiryDate()

    await createSession({
      userId: user.id,
      refreshToken,
      expiresAt: refreshExpiresAt,
    })

    const response = NextResponse.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        departmentId: user.departmentId,
        isActive: user.isActive,
      },
      role: user.role,
    })

    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, getCookieOptions(REFRESH_TOKEN_TTL_SECONDS))
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, getCookieOptions(ACCESS_TOKEN_TTL_SECONDS))

    return response
  } catch {
    return NextResponse.json(
      { error: "Не удалось выполнить вход. Попробуйте позже." },
      { status: 500 }
    )
  }
}
