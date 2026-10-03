/**
 * Приводит результат `db.execute(sql...)` к массиву строк.
 * node-postgres возвращает объект `{ rows }`, другие драйверы drizzle — сразу массив.
 * Проверка `Array.isArray(result)` без этого хелпера на pg всегда даёт пустой список.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const rows = (result as { rows?: unknown } | null | undefined)?.rows
  return Array.isArray(rows) ? (rows as T[]) : []
}
