import { describe, expect, it } from "vitest"
import fixtureRows from "./__fixtures__/staffing-sample.json"
import {
  buildPreviewTree,
  classifyStaffingRow,
  normalizeDepartmentKey,
  parseStaffingRows,
  type SheetRow,
} from "./one-c-staffing-parser"

const COLUMN_MAP = {
  employeeName: 0,
  hireDate: 1,
  phone: 2,
  plannedHeadcount: 3,
}

describe("one-c-staffing-parser", () => {
  it("classifies staffing row types", () => {
    const rows = fixtureRows as SheetRow[]
    expect(classifyStaffingRow(rows[9]!, COLUMN_MAP)).toBe("department")
    expect(classifyStaffingRow(rows[10]!, COLUMN_MAP)).toBe("position")
    expect(classifyStaffingRow(rows[11]!, COLUMN_MAP)).toBe("employee")
  })

  it("parses departments, assignments and stats from fixture", () => {
    const parsed = parseStaffingRows(fixtureRows as SheetRow[])

    expect(parsed.stats.positions).toBe(5)
    expect(parsed.stats.employees).toBe(5)
    expect(parsed.stats.departments).toBeGreaterThanOrEqual(4)

    const serviceDept = parsed.departments.find((dept) => dept.name === "Служба Эксплуатации_3")
    expect(serviceDept).toBeDefined()
    expect(serviceDept?.parentName).toBeNull()

    const opNn = parsed.departments.find((dept) => dept.name === "ОП (г. Нижний Новгород)")
    expect(opNn).toBeDefined()

    const ptg = parsed.departments.find((dept) =>
      dept.name.includes("Производственно-техническая группа")
    )
    expect(ptg?.parentName).toBe("ОП (г. Нижний Новгород)")

    const boguslavskaya = parsed.assignments.find((item) =>
      item.fullName.includes("Богуславская")
    )
    expect(boguslavskaya?.departmentName).toBe("Служба Эксплуатации_3")
    expect(boguslavskaya?.positionTitle).toBe("Инженер ПТО")
    expect(boguslavskaya?.hireDate).toBe("2023-12-18")

    const seleznev = parsed.assignments.find((item) => item.fullName.includes("Селезнев"))
    expect(seleznev?.departmentName).toBe("ОП (г. Нижний Новгород)")
    expect(seleznev?.phone).toBe("+7 999 000-00-01")
  })

  it("builds preview tree with nested children", () => {
    const parsed = parseStaffingRows(fixtureRows as SheetRow[])
    const tree = buildPreviewTree(parsed.departments)
    const opNn = tree.find((node) => node.name === "ОП (г. Нижний Новгород)")
    expect(opNn).toBeDefined()
    expect(opNn!.children.length).toBeGreaterThan(0)
  })

  it("normalizes department keys", () => {
    expect(normalizeDepartmentKey("  ОП (г. Нижний Новгород) ")).toBe("оп г нижний новгород")
  })
})
