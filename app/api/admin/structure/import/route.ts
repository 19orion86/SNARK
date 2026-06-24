import { NextRequest, NextResponse } from "next/server"
import { requireRole, type AuthError } from "@/lib/auth/request-auth"
import { writeAuditLog } from "@/lib/audit/log"
import { parseOneCStaffingWorkbook } from "@/lib/import/one-c-staffing-parser"
import { getPortalRepositoryServer } from "@/lib/repositories/portal-repository.server"
import {
  apiErrorSchema,
  orgStructureImportPreviewSchema,
  orgStructureImportResultSchema,
} from "@/lib/validators/portal"

export const maxDuration = 300

function parseBooleanField(value: FormDataEntryValue | null): boolean {
  if (value === null || value === undefined) return false
  const normalized = String(value).trim().toLowerCase()
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on"
}

async function readWorkbookFromRequest(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get("file")
  const mode = String(formData.get("mode") ?? "preview").trim().toLowerCase()

  if (!(file instanceof File)) {
    return {
      error: NextResponse.json(
        apiErrorSchema.parse({ error: "Файл не передан", code: "FILE_REQUIRED" }),
        { status: 400 }
      ),
    }
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return {
      error: NextResponse.json(
        apiErrorSchema.parse({ error: "Поддерживается только формат .xlsx", code: "INVALID_FILE_TYPE" }),
        { status: 400 }
      ),
    }
  }

  const buffer = await file.arrayBuffer()
  let parsed
  try {
    parsed = parseOneCStaffingWorkbook(buffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось разобрать файл"
    return {
      error: NextResponse.json(apiErrorSchema.parse({ error: message, code: "PARSE_ERROR" }), {
        status: 400,
      }),
    }
  }

  return {
    file,
    mode,
    parsed,
    applyDepartments: parseBooleanField(formData.get("applyDepartments")),
    applyEmployees: parseBooleanField(formData.get("applyEmployees")),
    syncMode: String(formData.get("syncMode") ?? "merge").trim().toLowerCase(),
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ["admin", "hr_manager"])
    const payload = await readWorkbookFromRequest(request)
    if ("error" in payload && payload.error) {
      return payload.error
    }

    const { file, mode, parsed, applyDepartments, applyEmployees, syncMode } = payload
    const repository = getPortalRepositoryServer()

    if (mode === "preview") {
      const preview = await repository.previewOrgStructureImport(parsed)
      return NextResponse.json(orgStructureImportPreviewSchema.parse(preview))
    }

    if (!applyDepartments && !applyEmployees) {
      return NextResponse.json(
        apiErrorSchema.parse({
          error: "Выберите хотя бы один тип данных для применения",
          code: "NOTHING_TO_APPLY",
        }),
        { status: 400 }
      )
    }

    const result = await repository.importOrgStructure(parsed, {
      applyDepartments,
      applyEmployees,
      syncMode: syncMode === "replace" || syncMode === "sync" ? syncMode : "merge",
      fileName: file.name,
      userId: auth.userId,
    })

    const response = orgStructureImportResultSchema.parse(result)
    await writeAuditLog({
      userId: auth.userId,
      action: "admin:structure:import",
      resourceType: "departments",
      statusCode: 200,
      metadata: JSON.stringify({
        fileName: file.name,
        applyDepartments,
        applyEmployees,
        ...response,
      }),
    })

    return NextResponse.json(response)
  } catch (error) {
    const known = error as Partial<AuthError>
    const status = known.status ?? 500
    const payload =
      status === 500
        ? apiErrorSchema.parse({ error: "Не удалось импортировать оргструктуру", code: "INTERNAL_ERROR" })
        : apiErrorSchema.parse({
            error: known.message ?? "Ошибка доступа",
            code: known.code ?? "AUTH_ERROR",
          })
    return NextResponse.json(payload, { status })
  }
}
