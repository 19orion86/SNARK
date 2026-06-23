/** Единый формат ФИО: Фамилия Имя Отчество */
export function formatFullName(
  lastName: string,
  firstName: string,
  middleName?: string | null
): string {
  return [lastName, firstName, middleName].filter((part) => part && part.trim()).join(" ").trim()
}

/** Инициалы: первая буква фамилии и имени */
export function formatInitials(lastName: string, firstName: string): string {
  const last = lastName.trim().charAt(0)
  const first = firstName.trim().charAt(0)
  if (!last && !first) return "??"
  return `${last}${first}`.toUpperCase()
}
