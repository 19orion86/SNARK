import { config } from "dotenv"
config({ path: ".env.local" })
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { employeeProfiles, users } from "@/lib/db/schema"

const MIN_SALT_ROUNDS = 12

interface UserSeed {
  email: string
  password: string
  firstName: string
  lastName: string
  role: "admin" | "hr_manager" | "employee"
  positionTitle: string
  phone?: string
}

// Список пользователей для инициализации
// ВАЖНО: поменяйте пароли перед запуском в продакшн
const USERS_TO_CREATE: UserSeed[] = [
  {
    email: "admin@snark.ru",
    password: "Admin2026Snark!",
    firstName: "Администратор",
    lastName: "Портала",
    role: "admin",
    positionTitle: "Администратор системы",
  },
  {
    email: "hr@snark.ru",
    password: "HR2026Snark!",
    firstName: "HR",
    lastName: "Менеджер",
    role: "hr_manager",
    positionTitle: "HR менеджер",
    phone: "+7 (900) 000-00-01",
  },
  {
    email: "employee@snark.ru",
    password: "Employee2026!",
    firstName: "Тестовый",
    lastName: "Сотрудник",
    role: "employee",
    positionTitle: "Специалист",
    phone: "+7 (900) 000-00-02",
  },
]

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL не задан")

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)
  let created = 0
  let skipped = 0

  try {
    for (const u of USERS_TO_CREATE) {
      // Проверить существует ли уже
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1)

      if (existing) {
        console.log(`⏭  Пропущен (уже есть): ${u.email}`)
        skipped++
        continue
      }

      const passwordHash = await bcrypt.hash(u.password, MIN_SALT_ROUNDS)

      const [newUser] = await db
        .insert(users)
        .values({
          email: u.email,
          passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: true,
        })
        .returning({ id: users.id })

      if (newUser) {
        await db.insert(employeeProfiles).values({
          userId: newUser.id,
          positionTitle: u.positionTitle,
          phone: u.phone ?? null,
          presence: "office",
          updatedAt: new Date(),
        })
        console.log(`✅ Создан [${u.role}]: ${u.email} / пароль: ${u.password}`)
        created++
      }
    }
  } finally {
    await pool.end()
  }

  console.log(`\nИтого: создано ${created}, пропущено ${skipped}`)
  if (created > 0) {
    console.log("\n⚠️  Смените пароли после первого входа!")
  }
}

main().catch((err) => {
  console.error("Ошибка:", err instanceof Error ? err.message : err)
  process.exit(1)
})
