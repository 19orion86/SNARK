import { Card } from "@/components/ui/card"

export default function AdminPage() {
  return (
    <Card className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-card-foreground">Панель администратора</h1>
      <p className="mt-3 text-muted-foreground">
        Раздел доступен только пользователям с ролью admin или hr_manager.
      </p>
    </Card>
  )
}
