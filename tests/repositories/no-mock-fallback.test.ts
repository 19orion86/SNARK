import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { getSidebarItems } from "@/lib/navigation/sidebar-items"

const root = process.cwd()

function read(relPath: string): string {
  return readFileSync(join(root, relPath), "utf8")
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}

describe("Фаза 1: при USE_MOCK_DB=false drizzle не обращается к mock", () => {
  it("drizzle-репозиторий не импортирует и не вызывает mock-репозиторий", () => {
    const source = read("lib/repositories/portal-repository.drizzle.ts")
    expect(source).not.toMatch(/portal-repository\.mock/)
    expect(source).not.toMatch(/mockPortalRepository/)
  })

  it("mock-репозиторий подключается только серверным переключателем режима", () => {
    const importers = ["app", "components", "hooks", "lib"]
      .flatMap((dir) => walk(dir))
      .filter((file) => file !== "lib/repositories/portal-repository.mock.ts")
      .filter((file) => /portal-repository\.mock/.test(read(file)))
    expect(importers).toEqual(["lib/repositories/portal-repository.server.ts"])
  })

  it("клиентский код не тянет репозитории данных в bundle", () => {
    const offenders = ["components", "hooks"]
      .flatMap((dir) => walk(dir))
      .filter((file) => /from "@\/lib\/repositories\/portal-repository(\.mock|\.drizzle|\.server)?"/.test(read(file)))
    expect(offenders).toEqual([])
  })
})

describe("Sidebar: статический конфиг", () => {
  it("содержит уникальные пункты с маршрутами", () => {
    const items = getSidebarItems()
    expect(items.length).toBeGreaterThan(5)
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length)
    expect(items.every((item) => item.href.startsWith("/"))).toBe(true)
  })

  it("админ-панель ограничена ролями admin и hr_manager", () => {
    const admin = getSidebarItems().find((item) => item.id === "admin")
    expect(admin?.roles).toEqual(["admin", "hr_manager"])
  })

  it("возвращает копии, а не общий объект конфига", () => {
    const first = getSidebarItems()
    first[0].label = "изменено"
    expect(getSidebarItems()[0].label).not.toBe("изменено")
  })
})
