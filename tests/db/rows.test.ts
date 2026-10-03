import { describe, expect, it } from "vitest"
import { rowsOf } from "@/lib/db/rows"

describe("rowsOf", () => {
  it("достаёт строки из результата node-postgres ({ rows })", () => {
    expect(rowsOf<{ id: number }>({ rows: [{ id: 1 }], rowCount: 1 })).toEqual([{ id: 1 }])
  })

  it("принимает массив как есть", () => {
    expect(rowsOf<{ id: number }>([{ id: 2 }])).toEqual([{ id: 2 }])
  })

  it("возвращает пустой список для пустого или неизвестного результата", () => {
    expect(rowsOf(null)).toEqual([])
    expect(rowsOf(undefined)).toEqual([])
    expect(rowsOf({})).toEqual([])
  })
})
