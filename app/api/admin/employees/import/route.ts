import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  adminEmployeeUpsertSchema,
  apiErrorSchema,
  employeeImportResponseSchema,
} from "@/lib/validators/portal"

type ExcelRow = Record<string, string | number | Date | null | undefined>

const HEADER_ALIASES = {
  fullName: ["фио", "фамилия+имя+отчество", "фамилия имя отчество"],
  positionTitle: ["должность"],
  departmentName: ["отдел"],
  phone: ["телефон"],
  email: ["email", "e-mail", "почта"],
  birthDate: ["дата рождения"],
  startDate: ["дата выхода"],
  welcomeNote: ["приветствие"],
} as const

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

function normalizeDate(value: string | number | Date | null | undefined): string | undefined {
  if (!value && value !== 0) return undefined
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
  const maybeDate = new Date(asString)
  if (!Number.isNaN(maybeDate.getTime())) {
    return maybeDate.toISOString().slice(0, 10)
  }
  const ruMatch = asString.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (ruMatch) {
    const [, day, month, year] = ruMatch
    return `${year}-${month}-${day}`
  }
  return undefined
}

function buildHeaderMap(headers: string[]): Record<string, string | undefined> {
  const normalized = headers.map((header) => ({ source: header, normalized: normalizeHeader(header) }))
  const result: Record<string, string | undefined> = {}

  for (const targetKey of Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>) {
    const aliases = HEADER_ALIASES[targetKey] as readonly string[]
    const found = normalized.find((item) => aliases.includes(item.normalized))
    result[targetKey] = found?.source
  }
  return result
}

function getCellValue(row: ExcelRow, key: string | undefined): string | number | Date | null | undefined {
  if (!key) return undefined
  return row[key]
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      const payload = apiErrorSchema.parse({
        error: "Файл не передан",
        code: "FILE_REQUIRED",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      const payload = apiErrorSchema.parse({
        error: "Поддерживается только формат .xlsx",
        code: "INVALID_FILE_TYPE",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      const payload = apiErrorSchema.parse({
        error: "В Excel-файле нет листов",
        code: "EMPTY_WORKBOOK",
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
      defval: "",
      raw: true,
    })

    if (rows.length === 0) {
      const response = employeeImportResponseSchema.parse({
        created: 0,
        updated: 0,
        errors: [],
      })
      return NextResponse.json(response)
    }

    const headers = Object.keys(rows[0] ?? {})
    const headerMap = buildHeaderMap(headers)
    const requiredHeaders = ["fullName", "positionTitle", "departmentName", "email"] as const
    const missing = requiredHeaders.filter((item) => !headerMap[item])

    if (missing.length > 0) {
      const payload = apiErrorSchema.parse({
        error: "Не найдены обязательные колонки",
        code: "MISSING_COLUMNS",
        details: missing.join(", "),
      })
      return NextResponse.json(payload, { status: 400 })
    }

    const validRows: Array<(typeof adminEmployeeUpsertSchema)["_output"]> = []
    const preValidationErrors: Array<{ row: number; reason: string }> = []

    rows.forEach((row, index) => {
      const fullName = String(getCellValue(row, headerMap.fullName) ?? "").trim()
      const positionTitle = String(getCellValue(row, headerMap.positionTitle) ?? "").trim()
      const departmentName = String(getCellValue(row, headerMap.departmentName) ?? "").trim()
      const email = String(getCellValue(row, headerMap.email) ?? "").trim().toLowerCase()

      const parsed = adminEmployeeUpsertSchema.safeParse({
        fullName,
        positionTitle,
        departmentName,
        phone: String(getCellValue(row, headerMap.phone) ?? "").trim() || undefined,
        email,
        birthDate: normalizeDate(getCellValue(row, headerMap.birthDate)),
        startDate: normalizeDate(getCellValue(row, headerMap.startDate)),
        welcomeNote: String(getCellValue(row, headerMap.welcomeNote) ?? "").trim() || undefined,
      })

      if (!parsed.success) {
        preValidationErrors.push({
          row: index + 2,
          reason: "Некорректные данные строки",
        })
        return
      }

      validRows.push(parsed.data)
    })

    const result = await getPortalRepositoryServer().importEmployees(validRows)
    const response = employeeImportResponseSchema.parse({
      created: result.created,
      updated: result.updated,
      errors: [...preValidationErrors, ...result.errors],
    })

    await writeAuditLog({
      userId: auth.userId,
      action: "admin:employees:import",
      resourceType: "users",
      statusCode: 200,
      metadata: JSON.stringify({
        created: response.created,
        updated: response.updated,
        errors: response.errors.length,
      }),
    })
    return NextResponse.json(response)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось импортировать сотрудников", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
