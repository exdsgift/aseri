import { expect, it } from "vitest"

import { remember } from "./art"

it("makes the art again only when it is asked with other arguments", () => {
  const made: number[] = []
  const twice = remember((n: number, label: string) => {
    made.push(n)
    return { n, label }
  })

  const first = twice(1, "a")
  expect(twice(1, "a")).toBe(first)
  expect(twice(2, "a")).not.toBe(first)
  expect(twice(2, "b").label).toBe("b")
  expect(made).toEqual([1, 2, 2])
})
