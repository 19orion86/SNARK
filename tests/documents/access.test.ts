import { describe, expect, it } from "vitest"
import { canViewDocument } from "@/lib/documents/access"

const DEPT_A = "11111111-1111-4111-8111-111111111111"
const DEPT_B = "22222222-2222-4222-8222-222222222222"

describe("canViewDocument", () => {
  it("admin и hr_manager видят документ любого отдела", () => {
    const doc = { access: "department", departmentId: DEPT_B }
    expect(canViewDocument({ role: "admin", departmentId: null }, doc)).toBe(true)
    expect(canViewDocument({ role: "hr_manager", departmentId: DEPT_A }, doc)).toBe(true)
  })

  it("public виден любому сотруднику", () => {
    expect(canViewDocument({ role: "employee", departmentId: null }, { access: "public" })).toBe(true)
  })

  it("сотрудник видит документ своего отдела и не видит чужого", () => {
    const requester = { role: "employee", departmentId: DEPT_A }
    expect(canViewDocument(requester, { access: "department", departmentId: DEPT_A })).toBe(true)
    expect(canViewDocument(requester, { access: "department", departmentId: DEPT_B })).toBe(false)
    expect(canViewDocument(requester, { access: "restricted", departmentId: null })).toBe(false)
  })

  it("сотрудник без отдела не видит документы отделов", () => {
    const requester = { role: "employee", departmentId: null }
    expect(canViewDocument(requester, { access: "department", departmentId: DEPT_B })).toBe(false)
  })
})
