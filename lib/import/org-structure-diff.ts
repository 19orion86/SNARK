import {
  buildPreviewTree,
  normalizeDepartmentKey,
  type ParsedAssignment,
  type ParsedDepartment,
  type ParsedOrgStructure,
} from "@/lib/import/one-c-staffing-parser"
import type {
  AdminDepartmentItem,
  OrgStructureDepartmentDiffItem,
  OrgStructureEmployeeDiffItem,
  OrgStructureImportPreview,
} from "@/types/portal"

function findDepartmentByKey(
  departments: AdminDepartmentItem[],
  externalKey: string,
  name: string
): AdminDepartmentItem | undefined {
  return (
    departments.find((dept) => dept.externalKey === externalKey) ??
    departments.find((dept) => normalizeDepartmentKey(dept.name) === normalizeDepartmentKey(name))
  )
}

function departmentNeedsUpdate(
  existing: AdminDepartmentItem,
  incoming: ParsedDepartment,
  existingParentName: string | null
): boolean {
  return (
    existing.plannedHeadcount !== incoming.plannedHeadcount ||
    normalizeDepartmentKey(existingParentName ?? "") !== normalizeDepartmentKey(incoming.parentName ?? "")
  )
}

function assignmentNeedsUpdate(
  existing: {
    departmentName: string
    positionTitle: string
    startDate?: string | null
  },
  incoming: ParsedAssignment
): boolean {
  return (
    normalizeDepartmentKey(existing.departmentName) !== normalizeDepartmentKey(incoming.departmentName) ||
    existing.positionTitle.trim() !== incoming.positionTitle.trim() ||
    (incoming.hireDate !== undefined && (existing.startDate ?? "") !== incoming.hireDate)
  )
}

export function buildOrgStructureImportPreview(
  parsed: ParsedOrgStructure,
  existingDepartments: AdminDepartmentItem[],
  existingEmployees: Array<{
    fullName: string
    departmentName: string
    positionTitle: string
    startDate?: string | null
  }>
): OrgStructureImportPreview {
  const parentNameById = new Map(
    existingDepartments.map((dept) => [dept.id, dept.parentName ?? null] as const)
  )

  const departmentDiff: OrgStructureDepartmentDiffItem[] = parsed.departments.map((incoming) => {
    const existing = findDepartmentByKey(existingDepartments, incoming.externalKey, incoming.name)
    const existingParentName = existing?.parentId
      ? (parentNameById.get(existing.parentId) ?? existing.parentName)
      : null

    let action: OrgStructureDepartmentDiffItem["action"] = "create"
    if (existing) {
      action = departmentNeedsUpdate(existing, incoming, existingParentName) ? "update" : "unchanged"
    }

    return {
      name: incoming.name,
      externalKey: incoming.externalKey,
      parentName: incoming.parentName,
      plannedHeadcount: incoming.plannedHeadcount,
      action,
    }
  })

  const employeeDiff: OrgStructureEmployeeDiffItem[] = parsed.assignments.map((assignment) => {
    const existing = existingEmployees.find(
      (employee) => normalizeDepartmentKey(employee.fullName) === normalizeDepartmentKey(assignment.fullName)
    )

    if (!existing) {
      return {
        fullName: assignment.fullName,
        departmentName: assignment.departmentName,
        positionTitle: assignment.positionTitle,
        hireDate: assignment.hireDate,
        action: "create",
      }
    }

    return {
      fullName: assignment.fullName,
      departmentName: assignment.departmentName,
      positionTitle: assignment.positionTitle,
      hireDate: assignment.hireDate,
      action: assignmentNeedsUpdate(existing, assignment) ? "update" : "unchanged",
    }
  })

  return {
    stats: parsed.stats,
    warnings: parsed.warnings,
    tree: buildPreviewTree(parsed.departments),
    departmentDiff,
    employeeDiff,
  }
}
