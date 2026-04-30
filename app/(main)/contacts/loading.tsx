export default function ContactsLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-72 animate-pulse rounded bg-muted" />
      <div className="h-20 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-48 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}
