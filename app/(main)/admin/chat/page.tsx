import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getServerSession } from "@/lib/auth/server-session"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Чат / AI CoPilot — Админ-панель",
}

export default async function AdminChatPage() {
  const session = await getServerSession()
  if (!session) redirect("/login")
  if (session.role !== "admin" && session.role !== "hr_manager") redirect("/admin")

  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim())

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold text-card-foreground">Чат и AI CoPilot</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Настройки ассистента для задач и внутренних подсказок. Полная конфигурация — в переменных
          окружения.
        </p>

        <div className="mt-6 space-y-3 rounded-md border p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">OPENAI_API_KEY</span>
            <span
              className={`text-sm font-medium ${openaiConfigured ? "text-emerald-600" : "text-amber-600"}`}
            >
              {openaiConfigured ? "настроен" : "не настроен"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Без ключа AI-подсказки в задачах недоступны. Укажите ключ в окружении сервера и
            перезапустите приложение.
          </p>
        </div>

        <div className="mt-6">
          <Link href="/chat">
            <Button className="bg-[#16223b] hover:bg-[#16223b]/90">Открыть чат</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
