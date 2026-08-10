import { distance } from "fastest-levenshtein"

export interface FioCandidate {
  id: string
  firstName: string
  lastName: string
}

/** Нормализация ФИО для сравнения. */
export function normalizeFio(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - distance(a, b) / maxLen
}

function expandInitials(needle: string): string[] {
  // «иванов ии» / «иванов и и» → варианты с инициалами
  const parts = needle.split(" ").filter(Boolean)
  if (parts.length < 2) return [needle]
  return [needle]
}

/**
 * Точный матч «Фамилия Имя» (и «Имя Фамилия»).
 * 0 или >1 совпадений → null.
 */
export function matchAssigneeExact(
  assigneeRaw: string | null | undefined,
  users: FioCandidate[]
): string | null {
  const needle = normalizeFio(assigneeRaw ?? "")
  if (!needle) return null

  const matches = users.filter((user) => {
    const lastFirst = normalizeFio(`${user.lastName} ${user.firstName}`)
    const firstLast = normalizeFio(`${user.firstName} ${user.lastName}`)
    return needle === lastFirst || needle === firstLast
  })

  if (matches.length === 1) return matches[0].id
  return null
}

/**
 * Fuzzy-match ФИО с порогом similarity ≥ minScore (по умолчанию 0.9).
 * Сначала exact; затем уникальный лучший кандидат ≥ порога.
 * Поддерживает «Иванов И.И.» через сравнение фамилии + инициалов.
 */
export function matchAssigneeFuzzy(
  assigneeRaw: string | null | undefined,
  users: FioCandidate[],
  minScore = 0.9
): string | null {
  const exact = matchAssigneeExact(assigneeRaw, users)
  if (exact) return exact

  const needle = normalizeFio(assigneeRaw ?? "")
  if (!needle) return null

  const needleParts = needle.split(" ").filter(Boolean)
  const scored: Array<{ id: string; score: number }> = []

  for (const user of users) {
    const lastFirst = normalizeFio(`${user.lastName} ${user.firstName}`)
    const firstLast = normalizeFio(`${user.firstName} ${user.lastName}`)
    let score = Math.max(similarity(needle, lastFirst), similarity(needle, firstLast))

    // Инициалы: «иванов ии» / «иванов и»
    if (needleParts.length >= 2) {
      const last = normalizeFio(user.lastName)
      const first = normalizeFio(user.firstName)
      const firstInitial = first.charAt(0)
      if (needleParts[0] === last || similarity(needleParts[0], last) >= minScore) {
        const rest = needleParts.slice(1).join("")
        if (rest === firstInitial || rest.startsWith(firstInitial) || rest === first) {
          score = Math.max(score, 0.92)
        }
      }
      if (needleParts[0] === first || similarity(needleParts[0], first) >= minScore) {
        const rest = needleParts.slice(1).join("")
        if (rest === normalizeFio(user.lastName).charAt(0) || rest === last) {
          score = Math.max(score, 0.92)
        }
      }
    }

    if (score >= minScore) {
      scored.push({ id: user.id, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  if (scored.length === 0) return null
  if (scored.length === 1) return scored[0].id
  // Уникальный лидер с отрывом; иначе ambiguous
  if (scored[0].score - scored[1].score >= 0.02) return scored[0].id
  if (scored[0].id === scored[1].id) return scored[0].id
  return null
}

/** @deprecated use matchAssigneeFuzzy — оставлено для совместимости тестов. */
export function matchAssignee(
  assigneeRaw: string | null | undefined,
  users: FioCandidate[]
): string | null {
  return matchAssigneeFuzzy(assigneeRaw, users, 0.9)
}

// keep helper referenced for tree-shaking-friendly export surface
void expandInitials
