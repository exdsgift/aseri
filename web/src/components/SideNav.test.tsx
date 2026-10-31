import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { SideNav, type Section } from "@/components/SideNav"

afterEach(cleanup)

const today: Section = { id: "today", icon: "risk", label: ["Risk", "today"] }
const record: Section = {
  id: "record",
  icon: "check",
  label: ["The", "record"],
  shortcut: "R",
}

it("skips a listed section that is not on the page, and its key does nothing", () => {
  const watched: Element[] = []
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe(target: Element) {
        watched.push(target)
      }
      disconnect() {}
    }
  )
  const scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView

  render(
    <>
      <section id="today" />
      <SideNav sections={[today, record]} />
    </>
  )
  fireEvent.keyDown(document.body, { key: "r" })

  expect(watched).toEqual([document.getElementById("today")])
  expect(scrollIntoView).not.toHaveBeenCalled()
})
