import { expect, type Page } from "@playwright/test"

export type E2ERole = "admin" | "hr_manager" | "employee"

const ENV_PREFIX: Record<E2ERole, string> = {
  admin: "DEV_ADMIN",
  hr_manager: "DEV_HR",
  employee: "DEV_EMPLOYEE",
}

/** Учётки из .env.local (те же, что создаёт `pnpm init:users`). */
export function credentials(role: E2ERole): { email: string; password: string } {
  const prefix = ENV_PREFIX[role]
  const email = process.env[`${prefix}_EMAIL`]
  const password = process.env[`${prefix}_PASSWORD`]
  if (!email || !password) {
    throw new Error(`Не заданы ${prefix}_EMAIL / ${prefix}_PASSWORD в .env.local`)
  }
  return { email, password }
}

export async function loginViaUi(page: Page, role: E2ERole): Promise<void> {
  const { email, password } = credentials(role)
  await page.goto("/login")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL("**/dashboard")
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
}

export function isoDate(daysFromNow: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString().slice(0, 10)
}
