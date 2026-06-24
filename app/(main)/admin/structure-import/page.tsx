import Link from "next/link"
import { redirect } from "next/navigation"
import { StructureImport } from "@/components/admin/structure-import"
import { Button } from "@/components/ui/button"
import { getServerSession } from "@/lib/auth/server-session"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Импорт оргструктуры — Админ-панель",
}

export default async function AdminStructureImportPage() {
  const session = await getServerSession()
  if (!session) {
    redirect("/login")
  }
  if (session.role !== "admin" && session.role !== "hr_manager") {
    redirect("/admin")
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Импорт оргструктуры из 1С</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Загрузка выгрузки «Штатная расстановка» с превью дерева и выбором данных для применения.
          </p>
        </div>
        <Link href="/admin/departments">
          <Button variant="outline">К подразделениям</Button>
        </Link>
      </div>

      <StructureImport />
    </div>
  )
}
