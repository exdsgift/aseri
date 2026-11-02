import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { Disclosure } from "./Disclosure"

afterEach(cleanup)

const shown = () => (
  <Disclosure label="How to read this">
    <p>The shaded range is where 8 in 10 days should land.</p>
  </Disclosure>
)

it("opens on the second layer only when asked, and says whether it is open", () => {
  render(shown())
  const button = screen.getByRole("button", { name: "How to read this" })
  const body = document.getElementById(button.getAttribute("aria-controls")!)!

  expect(button.getAttribute("aria-expanded")).toBe("false")
  expect(body.hidden).toBe(true)
  expect(body.textContent).toBe(
    "The shaded range is where 8 in 10 days should land."
  )

  fireEvent.click(button)
  expect(button.getAttribute("aria-expanded")).toBe("true")
  expect(body.hidden).toBe(false)

  fireEvent.click(button)
  expect(button.getAttribute("aria-expanded")).toBe("false")
  expect(body.hidden).toBe(true)
})

// A native button: Tab reaches it, and Enter and Space press it, as a click does here.
it("works by keyboard: a button in the tab order, which keeps the focus and its ring as it opens", () => {
  render(shown())
  const button = screen.getByRole("button", { name: "How to read this" })

  expect(button.tagName).toBe("BUTTON")
  expect(button.getAttribute("type")).toBe("button")
  expect(button.tabIndex).toBe(0)
  expect(button.className).toContain("focus-visible:outline-2")
  button.focus()
  fireEvent.click(button)
  expect(document.activeElement).toBe(button)
})

it("keeps the sign of its state out of its name", () => {
  render(shown())
  const button = screen.getByRole("button", { name: "How to read this" })
  expect(button.textContent).toBe("How to read this +")
  fireEvent.click(button)
  expect(button.textContent).toBe("How to read this -")
  expect(screen.getByRole("button", { name: "How to read this" })).toBe(button)
})
