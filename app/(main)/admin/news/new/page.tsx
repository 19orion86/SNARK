import { NewsEditorForm } from "@/components/admin/news-editor-form"

export default function AdminNewsCreatePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-card-foreground">Создать новость</h1>
      <NewsEditorForm />
    </div>
  )
}
