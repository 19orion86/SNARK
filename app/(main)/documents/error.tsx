"use client"

export default function DocumentsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        <p className="font-medium">Не удалось загрузить документы.</p>
        <p className="mt-2 text-sm opacity-90">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md border border-destructive px-3 py-1.5 text-sm hover:bg-destructive/10"
        >
          Повторить
        </button>
      </div>
    </div>
  )
}
