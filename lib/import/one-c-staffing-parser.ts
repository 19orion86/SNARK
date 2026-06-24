import * as XLSX from "xlsx"

export type CellValue = string | number | boolean | Date | null | undefined
export type SheetRow = CellValue[]

export type StaffingRowType = "department" | "position" | "employee" | "empty"

export interface StaffingColumnMap {
  employeeName: number
  hireDate: number
  phone: number
  plannedHeadcount: number
}

export interface ParsedDepartment {
  name: string
  plannedHeadcount: number
  parentName: string | null
  externalKey: string
}

export interface ParsedAssignment {
  fullName: string
  positionTitle: string
  departmentName: string
  hireDate?: string
  phone?: string
}

export interface ParsedOrgStructure {
  departments: ParsedDepartment[]
  assignments: ParsedAssignment[]
  warnings: string[]
  stats: { departments: number; positions: number; employees: number }
}

export interface ParsedOrgStructurePreviewTreeNode {
  name: string
  plannedHeadcount: number
  children: ParsedOrgStructurePreviewTreeNode[]
}

const HEADER_MARKER = "сотрудник"
const HEADER_SEARCH_LIMIT = 200
const DATE_RE = /^\s*(\d{2})\.(\d{2})\.(\d{4})\s*$/

const DEFAULT_COLUMN_MAP: StaffingColumnMap = {
  employeeName: 0,
  hireDate: 1,
  phone: 2,
  plannedHeadcount: 3,
}

export function toTrimmedString(value: CellValue): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  }
  return String(value).trim()
}

export function normalizeDate(value: CellValue): string | undefined {
  if (value === null || value === undefined || value === "") return undefined
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return undefined
    const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    return date.toISOString().slice(0, 10)
  }
  const asString = String(value).trim()
  if (!asString) return undefined
  const ruMatch = asString.match(DATE_RE)
  if (ruMatch) {
    const [, day, month, year] = ruMatch
    return `${year}-${month}-${day}`
  }
  const isoMatch = asString.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  const maybeDate = new Date(asString)
  if (!Number.isNaN(maybeDate.getTime())) {
    return maybeDate.toISOString().slice(0, 10)
  }
  return undefined
}

export function normalizeDepartmentKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(name: string): string[] {
  return normalizeDepartmentKey(name)
    .split(" ")
    .filter((token) => token.length >= 3)
}

export function fuzzyMatchDepartment(name: string, candidates: Set<string>): string | null {
  const normalized = normalizeDepartmentKey(name)
  for (const candidate of candidates) {
    if (normalizeDepartmentKey(candidate) === normalized) return candidate
  }
  const nameTokens = tokenize(name)
  let best: { candidate: string; score: number } | null = null
  for (const candidate of candidates) {
    const candidateTokens = tokenize(candidate)
    const shared = nameTokens.filter((token) =>
      candidateTokens.some((other) => other.includes(token) || token.includes(other))
    )
    const score = shared.length / Math.max(nameTokens.length, candidateTokens.length, 1)
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { candidate, score }
    }
  }
  return best?.candidate ?? null
}

function findHeaderRowIndex(rows: SheetRow[]): number {
  const limit = Math.min(rows.length, HEADER_SEARCH_LIMIT)
  for (let i = 0; i < limit; i += 1) {
    const cell = rows[i]?.[DEFAULT_COLUMN_MAP.employeeName]
    if (toTrimmedString(cell).toLowerCase() === HEADER_MARKER) {
      return i
    }
  }
  return -1
}

function detectColumnMap(rows: SheetRow[], headerIndex: number): StaffingColumnMap {
  const map = { ...DEFAULT_COLUMN_MAP }
  const headerRow = rows[headerIndex]
  if (!headerRow) return map

  for (let col = 0; col < headerRow.length; col += 1) {
    const label = toTrimmedString(headerRow[col]).toLowerCase()
    if (!label) continue
    if (label.includes("дата") && label.includes("прием")) map.hireDate = col
    if (label.includes("телефон") || label.includes("phone")) map.phone = col
  }

  for (let rowIndex = Math.max(0, headerIndex - 3); rowIndex < headerIndex; rowIndex += 1) {
    const row = rows[rowIndex]
    if (!row) continue
    for (let col = 0; col < row.length; col += 1) {
      const label = toTrimmedString(row[col]).toLowerCase()
      if (label.includes("запланировано")) map.plannedHeadcount = col
    }
  }

  return map
}

export function classifyStaffingRow(row: SheetRow, columnMap: StaffingColumnMap): StaffingRowType {
  const name = toTrimmedString(row[columnMap.employeeName])
  if (!name) return "empty"
  const hireDateRaw = row[columnMap.hireDate]
  if (normalizeDate(hireDateRaw)) return "employee"
  if (name.includes("/")) return "position"
  const planned = row[columnMap.plannedHeadcount]
  if (planned !== null && planned !== undefined && planned !== "" && !Number.isNaN(Number(planned))) {
    return "department"
  }
  return "empty"
}

function parsePositionRow(name: string): { positionTitle: string; departmentPath: string[] } {
  const parts = name.split("/").map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 1) {
    return { positionTitle: name.replace(/\//g, " ").trim(), departmentPath: [] }
  }
  return {
    positionTitle: parts[0] ?? name,
    departmentPath: parts.slice(1),
  }
}

function isOrgDepartment(name: string, pathDepartments: Set<string>): boolean {
  if (fuzzyMatchDepartment(name, pathDepartments)) return true
  return pathDepartments.size === 0
}

function buildDepartmentHierarchy(
  rows: SheetRow[],
  startIndex: number,
  columnMap: StaffingColumnMap,
  pathDepartments: Set<string>,
  aliasMap: Map<string, string>,
  warnings: string[]
): ParsedDepartment[] {
  const stack: Array<{ name: string; staff: number }> = []
  const edges = new Map<string, string | null>()
  const headcountByName = new Map<string, number>()

  for (let i = startIndex; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row) continue
    const type = classifyStaffingRow(row, columnMap)
    if (type !== "department") continue

    const rawName = toTrimmedString(row[columnMap.employeeName])
    const staff = Number(row[columnMap.plannedHeadcount])
    if (!rawName || Number.isNaN(staff)) continue

    const canonical =
      aliasMap.get(rawName) ?? fuzzyMatchDepartment(rawName, pathDepartments) ?? rawName
    if (canonical !== rawName) {
      aliasMap.set(rawName, canonical)
    }

    if (!isOrgDepartment(canonical, pathDepartments)) continue

    if (stack.length > 0 && stack[stack.length - 1]!.name === canonical) {
      continue
    }

    while (stack.length > 0 && staff > stack[stack.length - 1]!.staff) {
      stack.pop()
    }

    const parentName = stack.length > 0 ? stack[stack.length - 1]!.name : null
    if (!edges.has(canonical)) {
      edges.set(canonical, parentName)
    } else {
      const existingParent = edges.get(canonical)
      if (existingParent !== parentName) {
        warnings.push(
          `Подразделение «${canonical}» встречается с разными родителями: «${existingParent ?? "корень"}» и «${parentName ?? "корень"}»`
        )
      }
    }

    headcountByName.set(canonical, Math.max(headcountByName.get(canonical) ?? 0, staff))
    stack.push({ name: canonical, staff })
  }

  for (const pathDept of pathDepartments) {
    if (!edges.has(pathDept)) {
      edges.set(pathDept, null)
      warnings.push(`Подразделение «${pathDept}» найдено только в путях позиций, родитель не определён`)
    }
  }

  return [...edges.entries()].map(([name, parentName]) => ({
    name,
    plannedHeadcount: headcountByName.get(name) ?? 0,
    parentName,
    externalKey: normalizeDepartmentKey(name),
  }))
}

export function parseStaffingRows(rows: SheetRow[]): ParsedOrgStructure {
  const warnings: string[] = []
  const headerIndex = findHeaderRowIndex(rows)
  if (headerIndex === -1) {
    throw new Error('Не найдена строка-заголовок "Сотрудник" в первой колонке')
  }

  const columnMap = detectColumnMap(rows, headerIndex)
  const aliasMap = new Map<string, string>()
  const pathDepartments = new Set<string>()
  let positionCount = 0
  let employeeCount = 0

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row) continue
    const type = classifyStaffingRow(row, columnMap)
    if (type === "position") {
      positionCount += 1
      const { departmentPath } = parsePositionRow(toTrimmedString(row[columnMap.employeeName]))
      for (const segment of departmentPath) {
        pathDepartments.add(segment)
      }
    } else if (type === "employee") {
      employeeCount += 1
    }
  }

  for (const pathDept of pathDepartments) {
    const matched = fuzzyMatchDepartment(pathDept, new Set([...pathDepartments].filter((n) => n !== pathDept)))
    if (matched && matched !== pathDept) {
      aliasMap.set(pathDept, matched)
    }
  }

  const departments = buildDepartmentHierarchy(
    rows,
    headerIndex + 1,
    columnMap,
    pathDepartments,
    aliasMap,
    warnings
  )

  const resolveDepartmentName = (raw: string): string => {
    if (aliasMap.has(raw)) return aliasMap.get(raw)!
    const matched = fuzzyMatchDepartment(raw, new Set(departments.map((dept) => dept.name)))
    return matched ?? raw
  }

  const assignments: ParsedAssignment[] = []
  let currentPosition: { positionTitle: string; departmentName: string } | null = null

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row) continue
    const type = classifyStaffingRow(row, columnMap)

    if (type === "position") {
      const parsed = parsePositionRow(toTrimmedString(row[columnMap.employeeName]))
      const rawDept = parsed.departmentPath[parsed.departmentPath.length - 1]
      if (!rawDept) {
        warnings.push(`Строка ${i + 1}: позиция без подразделения — «${parsed.positionTitle}»`)
        currentPosition = null
        continue
      }
      currentPosition = {
        positionTitle: parsed.positionTitle,
        departmentName: resolveDepartmentName(rawDept),
      }
      continue
    }

    if (type === "employee") {
      const fullName = toTrimmedString(row[columnMap.employeeName])
      if (!currentPosition) {
        warnings.push(`Строка ${i + 1}: сотрудник «${fullName}» без позиции выше`)
        continue
      }
      assignments.push({
        fullName,
        positionTitle: currentPosition.positionTitle,
        departmentName: currentPosition.departmentName,
        hireDate: normalizeDate(row[columnMap.hireDate]),
        phone: toTrimmedString(row[columnMap.phone]) || undefined,
      })
    }
  }

  return {
    departments,
    assignments,
    warnings,
    stats: {
      departments: departments.length,
      positions: positionCount,
      employees: employeeCount,
    },
  }
}

export function parseOneCStaffingWorkbook(buffer: ArrayBuffer): ParsedOrgStructure {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error("В Excel-файле нет листов")
  }
  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<SheetRow>(worksheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })
  return parseStaffingRows(rows)
}

export function buildPreviewTree(departments: ParsedDepartment[]): ParsedOrgStructurePreviewTreeNode[] {
  const nodeByName = new Map<string, ParsedOrgStructurePreviewTreeNode>()
  for (const dept of departments) {
    nodeByName.set(dept.name, {
      name: dept.name,
      plannedHeadcount: dept.plannedHeadcount,
      children: [],
    })
  }

  const roots: ParsedOrgStructurePreviewTreeNode[] = []
  for (const dept of departments) {
    const node = nodeByName.get(dept.name)
    if (!node) continue
    if (dept.parentName && nodeByName.has(dept.parentName)) {
      nodeByName.get(dept.parentName)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortRecursive = (nodes: ParsedOrgStructurePreviewTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "ru"))
    for (const node of nodes) sortRecursive(node.children)
  }
  sortRecursive(roots)
  return roots
}
