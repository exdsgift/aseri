import { describe, expect, it } from "vitest"

import { heroes, nextTurn, storedChoice, storeChoice } from "./heroes"

// A reader's storage, as the page sees it.
const storage = (items: Record<string, string> = {}) => {
  const store = {
    getItem: (key: string) => items[key] ?? null,
    setItem: (key: string, value: string) => void (items[key] = value),
  } as Storage
  return { items, open: () => store }
}
// Storage the browser refuses: a private window, blocked site data.
const refused = () => {
  throw new DOMException("The operation is insecure.", "SecurityError")
}

describe("nextTurn", () => {
  it("shows the heroes in turn, one a page load, from the first", () => {
    const { open } = storage()
    expect(Array.from({ length: 7 }, () => nextTurn(open))).toEqual([
      "messenger",
      "signal",
      "vortex",
      "messenger",
      "signal",
      "vortex",
      "messenger",
    ])
  })

  it("keeps the turn as an index, and starts again from the first on one it cannot read", () => {
    const { items, open } = storage({ "aseri.turn": "1" })
    expect(nextTurn(open)).toBe("vortex")
    expect(items["aseri.turn"]).toBe("2")
    for (const junk of ["", "x", "-1", "1.5", "3"]) {
      items["aseri.turn"] = junk
      expect(nextTurn(open)).toBe("messenger")
    }
  })

  it("picks one at random when storage is refused, or cannot be written", () => {
    expect(nextTurn(refused, () => 0.5)).toBe("signal")
    expect(nextTurn(refused, () => 0.99)).toBe("vortex")
    const full = () =>
      ({
        getItem: () => "0",
        setItem: () => {
          throw new DOMException("Full", "QuotaExceededError")
        },
      }) as unknown as Storage
    expect(nextTurn(full, () => 0)).toBe("messenger")
  })
})

describe("the reader's choice", () => {
  it("rotates until the reader picks a hero, and remembers the pick", () => {
    const { items, open } = storage()
    expect(storedChoice(open)).toBe("rotate")
    for (const choice of [...heroes, "rotate"] as const) {
      storeChoice(choice, open)
      expect(storedChoice(open)).toBe(choice)
    }
    items["aseri.hero"] = "sun"
    expect(storedChoice(open)).toBe("rotate")
  })

  it("rotates, and keeps the page up, when storage is refused", () => {
    expect(storedChoice(refused)).toBe("rotate")
    expect(() => storeChoice("signal", refused)).not.toThrow()
  })
})
