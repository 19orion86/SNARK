import { StructureView } from "@/components/structure/structure-view"
import { loadDepartmentsTree } from "@/lib/portal-data/loaders"

export const metadata = {
  title: "Оргструктура",
}

export default async function StructurePage() {
  const { departments } = await loadDepartmentsTree()

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Оргструктура компании</h1>
        <p className="text-sm text-muted-foreground">
          Подразделения, руководители и численность сотрудников
        </p>
      </header>

      <StructureView nodes={departments} />
    </div>
  )
}
