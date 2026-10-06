// @vitest-environment node
import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { NextRequest } from "next/server"
import { beforeAll, describe, expect, it } from "vitest"
import type { UserRole } from "@/types/auth"

/**
 * ACL-сетка: employee / hr_manager / admin / аноним × критичные route handlers
 * (admin/**, tasks, chat и прочие с ролевым ограничением).
 *
 * middleware пропускает `/api/*` без проверки, поэтому единственная защита —
 * requireAuth / requireRole внутри обработчика. Тест вызывает обработчики
 * напрямую с подписанным access-токеном нужной роли.
 * Отказ (401/403) происходит до обращения к данным; для разрешённых ролей
 * проверяем только то, что ответ не 401/403 (БД в unit-прогоне нет).
 */

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
type Method = (typeof METHODS)[number]
type Handler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>

const ROLES: UserRole[] = ["admin", "hr_manager", "employee"]
const USER_IDS: Record<UserRole, string> = {
  admin: "00000000-0000-4000-8000-000000000001",
  hr_manager: "00000000-0000-4000-8000-000000000002",
  employee: "00000000-0000-4000-8000-000000000003",
}
const SAMPLE_ID = "11111111-1111-4111-8111-111111111111"

/** Маршруты, доступные только роли admin (hr_manager получает 403). */
const ADMIN_ONLY: Array<{ file: RegExp; methods?: Method[] }> = [
  { file: /^app\/api\/admin\/users\// },
  { file: /^app\/api\/admin\/tickets\// },
  { file: /^app\/api\/admin\/employees\/\[id\]\/route\.ts$/, methods: ["DELETE"] },
  { file: /^app\/api\/automation-rules\/route\.ts$/ },
]

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) routeFiles(full, out)
    else if (name === "route.ts") out.push(relative(process.cwd(), full).split(sep).join("/"))
  }
  return out
}

function isAdminOnly(file: string, method: Method): boolean {
  return ADMIN_ONLY.some((rule) => rule.file.test(file) && (!rule.methods || rule.methods.includes(method)))
}

function paramsFor(file: string): Record<string, string> {
  const params: Record<string, string> = {}
  for (const match of file.matchAll(/\[(\w+)\]/g)) params[match[1]] = SAMPLE_ID
  return params
}

function buildRequest(file: string, method: Method, token: string | null): NextRequest {
  const path = file
    .replace(/^app/, "")
    .replace(/\/route\.ts$/, "")
    .replace(/\[\w+\]/g, SAMPLE_ID)
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify({}),
  })
}

const tokens = {} as Record<UserRole, string>

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret-for-acl-suite-0123456789"
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-acl-suite-0123456789"
  process.env.USE_MOCK_DB = "true"
  // Порт 1 закрыт: обращение к БД завершается мгновенным отказом, а не таймаутом.
  process.env.DATABASE_URL = "postgres://acl:acl@127.0.0.1:1/acl"
  const { generateAccessToken } = await import("@/lib/auth/tokens")
  for (const role of ROLES) {
    tokens[role] = generateAccessToken({ userId: USER_IDS[role], email: `${role}@snark.test`, role })
  }
})

async function call(file: string, method: Method, role: UserRole | null): Promise<number | null> {
  const mod = (await import(/* @vite-ignore */ `@/${file.replace(/\.ts$/, "")}`)) as Partial<Record<Method, Handler>>
  const handler = mod[method]
  if (!handler) return null
  const response = await handler(buildRequest(file, method, role ? tokens[role] : null), {
    params: Promise.resolve(paramsFor(file)),
  })
  return response.status
}

describe("ACL: /api/admin/** и admin-only маршруты", () => {
  const files = [...routeFiles("app/api/admin"), "app/api/automation-rules/route.ts"]

  for (const file of files) {
    for (const method of METHODS) {
      it(`${method} ${file}`, async () => {
        const anonymous = await call(file, method, null)
        if (anonymous === null) return
        expect(anonymous, "аноним").toBe(401)
        expect(await call(file, method, "employee"), "employee").toBe(403)

        const hr = await call(file, method, "hr_manager")
        if (isAdminOnly(file, method)) expect(hr, "hr_manager на admin-only").toBe(403)
        else expect([401, 403], "hr_manager допущен").not.toContain(hr)

        expect([401, 403], "admin допущен").not.toContain(await call(file, method, "admin"))
      })
    }
  }
})

describe("ACL: tasks, chat и остальные API требуют сессию", () => {
  const publicFiles = new Set([
    "app/api/auth/login/route.ts",
    "app/api/auth/logout/route.ts",
    "app/api/auth/refresh/route.ts",
  ])
  const files = routeFiles("app/api").filter(
    (file) => !file.startsWith("app/api/admin/") && !publicFiles.has(file)
  )

  for (const file of files) {
    it(`аноним получает 401/403: ${file}`, async () => {
      for (const method of METHODS) {
        const status = await call(file, method, null)
        if (status === null) continue
        expect([401, 403], `${method} без сессии`).toContain(status)
      }
    })
  }
})

describe("ACL: ролевые ограничения вне /api/admin", () => {
  const cases: Array<{ file: string; method: Method }> = [
    { file: "app/api/vacations/[id]/approvals/route.ts", method: "POST" },
    { file: "app/api/news/cover-upload/route.ts", method: "POST" },
    { file: "app/api/documents/metadata/route.ts", method: "POST" },
    { file: "app/api/documents/[id]/versions/route.ts", method: "POST" },
  ]

  for (const { file, method } of cases) {
    it(`employee получает 403, hr_manager и admin допущены: ${method} ${file}`, async () => {
      expect(await call(file, method, "employee")).toBe(403)
      expect([401, 403]).not.toContain(await call(file, method, "hr_manager"))
      expect([401, 403]).not.toContain(await call(file, method, "admin"))
    })
  }
})
