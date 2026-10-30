import { describe, expect, it } from "vitest"

import { countUp, ditherCells } from "./motion"

describe("countUp", () => {
  it("counts from 0 and ends exactly on the value as the page writes it", () => {
    expect(countUp(181.4)[0]).toBe("0")
    expect(countUp(181.4).at(-1)).toBe("181")
    expect(countUp(1234.6).at(-1)).toBe("1,235")
  })

  it("never counts back down", () => {
    const shown = countUp(181.4).map(Number)
    expect(shown).toEqual(shown.toSorted((a, b) => a - b))
  })
})

describe("ditherCells", () => {
  const key = ([x, y]: number[]) => `${x},${y}`

  it("dithers in over 8 steps, from 2 of the 16 cells to all of them", () => {
    expect(ditherCells(0)).toHaveLength(2)
    expect(ditherCells(7)).toHaveLength(16)
  })

  it("keeps every cell it has lit, so nothing flickers", () => {
    for (let step = 1; step < 8; step++)
      expect(ditherCells(step).map(key)).toEqual(
        expect.arrayContaining(ditherCells(step - 1).map(key))
      )
  })

  it("is a checkerboard halfway", () => {
    const lit = new Set(ditherCells(3).map(key))
    expect(lit.size).toBe(8)
    for (const cell of lit) {
      const [x, y] = cell.split(",").map(Number)
      expect(lit.has(`${(x + 1) % 4},${y}`)).toBe(false)
    }
  })
})
