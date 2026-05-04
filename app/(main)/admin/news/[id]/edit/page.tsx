import { NewsEditorForm } from "@/components/admin/news-editor-form"

interface AdminNewsEditPageProps {
  params: Promise<{ id: string }>
}

export default async function AdminNewsEditPage({ params }: AdminNewsEditPageProps) {
  const { id } = await params
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-card-foreground">Редактировать новость</h1>
      <NewsEditorForm newsId={id} />
    </div>
  )
}
