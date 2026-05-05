import { config } from "dotenv"
config({ path: ".env.local" })
import bcrypt from "bcryptjs"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { users } from "@/lib/db/schema"
import type { UserRole } from "@/types/auth"

const ROLE_VALUES: UserRole[] = ["admin", "hr_manager", "employee"]
const MIN_SALT_ROUNDS = 12

interface CliArgs {
  email?: string
  password?: string
  role?: string
}

function parseArgs(argv: string[]): CliArgs {
  return argv.reduce<CliArgs>((acc, arg) => {
    if (!arg.startsWith("--")) return acc
    const [rawKey, ...rest] = arg.slice(2).split("=")
    const value = rest.join("=")
    if (!rawKey || !value) return acc
    if (rawKey === "email" || rawKey === "password" || rawKey === "role") {
      acc[rawKey] = value
    }
    return acc
  }, {})
}

function getSaltRounds(): number {
  const raw = Number(process.env.PASSWORD_SALT_ROUNDS ?? MIN_SALT_ROUNDS)
  if (Number.isNaN(raw)) return MIN_SALT_ROUNDS
  return Math.max(raw, MIN_SALT_ROUNDS)
}

function assertArgs(args: CliArgs): asserts args is {
  email: string
  password: string
  role: UserRole
} {
  if (!args.email || !args.password || !args.role) {
    throw new Error(
      "Укажите аргументы: --email=... --password=... --role=admin|hr_manager|employee"
    )
  }
  if (!ROLE_VALUES.includes(args.role as UserRole)) {
    throw new Error("Роль должна быть одной из: admin, hr_manager, employee")
  }
}

function toUserRole(role: string): UserRole {
  return role as UserRole
}

function toDisplayName(email: string): { firstName: string; lastName: string } {
  const localPart = email.split("@")[0] || "test.user"
  const [firstRaw, secondRaw] = localPart.split(/[._-]/)
  const firstName = firstRaw ? firstRaw.slice(0, 64) : "Тестовый"
  const lastName = secondRaw ? secondRaw.slice(0, 64) : "Пользователь"
  return {
    firstName: firstName || "Тестовый",
    lastName: lastName || "Пользователь",
  }
}

interface PostgresErrorLike {
  code?: string
  constraint?: string
  message?: string
  cause?: unknown
}

function isUniqueViolation(error: unknown): error is PostgresErrorLike {
  if (!error || typeof error !== "object") return false
  const maybePgError = error as PostgresErrorLike
  const rootCause =
    maybePgError.cause && typeof maybePgError.cause === "object"
      ? (maybePgError.cause as PostgresErrorLike)
      : null

  const message = maybePgError.message ?? ""
  const causeMessage = rootCause?.message ?? ""

  return (
    maybePgError.code === "23505" ||
    rootCause?.code === "23505" ||
    message.toLowerCase().includes("duplicate key") ||
    causeMessage.toLowerCase().includes("duplicate key")
  )
}

async function main() {
  const cliArgs = parseArgs(process.argv.slice(2))
  assertArgs(cliArgs)

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL не задан. Проверьте .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  const { firstName, lastName } = toDisplayName(cliArgs.email)
  const passwordHash = await bcrypt.hash(cliArgs.password, getSaltRounds())

  try {
    await db.insert(users).values({
      email: cliArgs.email,
      passwordHash,
      firstName,
      lastName,
      role: toUserRole(cliArgs.role),
      isActive: true,
    })
  } finally {
    await pool.end()
  }

  console.log(`✅ Пользователь создан: ${cliArgs.email}`)
}

main().catch((error: unknown) => {
  if (isUniqueViolation(error)) {
    console.error("Ошибка создания пользователя: email уже занят")
    process.exit(1)
  }

  const message = error instanceof Error ? error.message : "Неизвестная ошибка"
  console.error(`Ошибка создания пользователя: ${message}`)
  process.exit(1)
})
