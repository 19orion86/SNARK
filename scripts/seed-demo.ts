import { config } from "dotenv"
config({ path: ".env.local" })
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { departments, employeeProfiles, users } from "@/lib/db/schema"

const DEFAULT_PASSWORD = "Temp123456"
const MIN_SALT_ROUNDS = 12

interface DemoEmployeeSeed {
  fullName: string
  email: string
  departmentName: "IT-отдел" | "Бухгалтерия" | "Отдел кадров"
  positionTitle: string
  phone: string
  birthDate?: string
  startDate?: string
}

function getSaltRounds(): number {
  const raw = Number(process.env.PASSWORD_SALT_ROUNDS ?? MIN_SALT_ROUNDS)
  if (Number.isNaN(raw)) return MIN_SALT_ROUNDS
  return Math.max(raw, MIN_SALT_ROUNDS)
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(base: Date, days: number): string {
  const copy = new Date(base)
  copy.setDate(base.getDate() + days)
  return toIsoDate(copy)
}

function getCurrentMonthDate(base: Date, day: number): string {
  const date = new Date(base.getFullYear(), base.getMonth(), day)
  return toIsoDate(date)
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL не задан. Проверьте .env.local")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)
  let createdDepartments = 0
  let createdEmployees = 0

  const today = new Date()
  const birthdayToday = toIsoDate(today)
  const nextWeekBirthdays = [addDays(today, 1), addDays(today, 2), addDays(today, 4), addDays(today, 6)]

  const deptSeeds = [
    { name: "IT-отдел", code: "IT", contactEmail: "it@snark.ru" },
    { name: "Бухгалтерия", code: "ACC", contactEmail: "accounting@snark.ru" },
    { name: "Отдел кадров", code: "HR", contactEmail: "hr@snark.ru" },
  ] as const

  try {
    const departmentIds: Record<string, string> = {}

    for (const dept of deptSeeds) {
      const [existing] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.name, dept.name))
        .limit(1)

      if (existing) {
        departmentIds[dept.name] = existing.id
        continue
      }

      const [created] = await db
        .insert(departments)
        .values({
          name: dept.name,
          code: dept.code,
          contactEmail: dept.contactEmail,
        })
        .returning({ id: departments.id })

      if (created) {
        departmentIds[dept.name] = created.id
        createdDepartments += 1
      }
    }

    const employees: DemoEmployeeSeed[] = [
      {
        fullName: "Иванов Иван Иванович",
        email: "i.ivanov@snark.ru",
        departmentName: "IT-отдел",
        positionTitle: "Системный администратор",
        phone: "+7 (900) 100-00-01",
        birthDate: birthdayToday,
        startDate: getCurrentMonthDate(today, 2),
      },
      {
        fullName: "Петрова Анна Сергеевна",
        email: "a.petrova@snark.ru",
        departmentName: "IT-отдел",
        positionTitle: "Frontend разработчик",
        phone: "+7 (900) 100-00-02",
        birthDate: birthdayToday,
        startDate: getCurrentMonthDate(today, 5),
      },
      {
        fullName: "Сидоров Михаил Олегович",
        email: "m.sidorov@snark.ru",
        departmentName: "IT-отдел",
        positionTitle: "Backend разработчик",
        phone: "+7 (900) 100-00-03",
        birthDate: birthdayToday,
      },
      {
        fullName: "Козлова Елена Дмитриевна",
        email: "e.kozlova@snark.ru",
        departmentName: "IT-отдел",
        positionTitle: "Тестировщик",
        phone: "+7 (900) 100-00-04",
        birthDate: nextWeekBirthdays[0],
      },
      {
        fullName: "Новиков Артём Петрович",
        email: "a.novikov@snark.ru",
        departmentName: "Бухгалтерия",
        positionTitle: "Главный бухгалтер",
        phone: "+7 (900) 100-00-05",
        birthDate: nextWeekBirthdays[1],
        startDate: getCurrentMonthDate(today, 9),
      },
      {
        fullName: "Морозова Юлия Александровна",
        email: "y.morozova@snark.ru",
        departmentName: "Бухгалтерия",
        positionTitle: "Бухгалтер",
        phone: "+7 (900) 100-00-06",
        birthDate: nextWeekBirthdays[2],
      },
      {
        fullName: "Волков Дмитрий Сергеевич",
        email: "d.volkov@snark.ru",
        departmentName: "Бухгалтерия",
        positionTitle: "Экономист",
        phone: "+7 (900) 100-00-07",
      },
      {
        fullName: "Лебедева Татьяна Игоревна",
        email: "t.lebedeva@snark.ru",
        departmentName: "Отдел кадров",
        positionTitle: "HR менеджер",
        phone: "+7 (900) 100-00-08",
        birthDate: nextWeekBirthdays[3],
      },
      {
        fullName: "Соколов Андрей Васильевич",
        email: "a.sokolov@snark.ru",
        departmentName: "Отдел кадров",
        positionTitle: "Специалист по подбору",
        phone: "+7 (900) 100-00-09",
      },
      {
        fullName: "Никитина Ольга Николаевна",
        email: "o.nikitina@snark.ru",
        departmentName: "Отдел кадров",
        positionTitle: "Инспектор по кадрам",
        phone: "+7 (900) 100-00-10",
      },
    ]

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, getSaltRounds())

    for (const employee of employees) {
      const [lastName = "", firstName = "", middleName = ""] = employee.fullName.split(" ")
      const departmentId = departmentIds[employee.departmentName]
      if (!departmentId) {
        throw new Error(`Отдел не найден: ${employee.departmentName}`)
      }

      const [createdUser] = await db
        .insert(users)
        .values({
          email: employee.email,
          passwordHash,
          firstName: firstName || "Неизвестно",
          lastName: lastName || middleName || "Неизвестно",
          role: "employee",
          departmentId,
          isActive: true,
        })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id })

      let userId = createdUser?.id
      if (createdUser) {
        createdEmployees += 1
      } else {
        const [existingUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, employee.email))
          .limit(1)
        userId = existingUser?.id
      }

      if (!userId) continue

      await db
        .insert(employeeProfiles)
        .values({
          userId,
          phone: employee.phone,
          positionTitle: employee.positionTitle,
          birthDate: employee.birthDate ?? null,
          startDate: employee.startDate ?? null,
          office: "Головной офис",
          presence: "office",
          welcomeNote: `Добро пожаловать, ${firstName || employee.fullName}!`,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: employeeProfiles.userId,
          set: {
            phone: employee.phone,
            positionTitle: employee.positionTitle,
            birthDate: employee.birthDate ?? null,
            startDate: employee.startDate ?? null,
            office: "Головной офис",
            updatedAt: new Date(),
          },
        })
    }
  } finally {
    await pool.end()
  }

  console.log(`Создано ${createdDepartments} отделов, ${createdEmployees} сотрудников`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Неизвестная ошибка"
  console.error(`Ошибка seed: ${message}`)
  process.exit(1)
})
