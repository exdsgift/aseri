import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { Footer } from "./Footer"

afterEach(cleanup)

it("signs the page, with its licences, its source and each hero's engraving", () => {
  const { container } = render(<Footer choice="rotate" onChoose={() => {}} />)

  const footer = container.querySelector("footer")!
  expect(
    [...footer.querySelectorAll("p, li")].map((e) => e.textContent)
  ).toEqual([
    "aseri",
    "© 2026 Gabriele Durante",
    "Code: MIT · Forecasts and data: CC BY-NC 4.0",
    "The data, as an API, and its licences",
    "Source: github.com/exdsgift/aseri",
    "Messenger: Hendrick Goltzius after Polidoro da Caravaggio, Mercury, probably 1592, National Gallery of Art, CC0, from Wikimedia Commons",
    "Signal: Hendrick Goltzius, The Farnese Hercules, c. 1592, published 1617, The Metropolitan Museum of Art, CC0, from Wikimedia Commons",
    "Vortex: Apollo Belvedere (Apollo Pythius), engraving, Rijksmuseum, CC0, from Wikimedia Commons",
  ])
  expect(
    within(footer)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
  ).toEqual([
    "https://github.com/exdsgift/aseri/blob/master/LICENSE",
    "https://creativecommons.org/licenses/by-nc/4.0/",
    "api/",
    "https://github.com/exdsgift/aseri",
    "https://commons.wikimedia.org/wiki/File:Hendrik_Goltzius_after_Polidoro_da_Caravaggio,_Mercury,_probably_1592,_NGA_60693.jpg",
    "https://commons.wikimedia.org/wiki/File:Farnese_Hercules_MET_DP102198.jpg",
    "https://commons.wikimedia.org/wiki/File:Apollo_Belvedere_Apollo_Pythius_(titel_op_object),_RP-P-OB-102.457.jpg",
  ])
})

it("offers each hero or the turns, the reader's choice pressed, each a button with a focus ring", () => {
  const onChoose = vi.fn()
  render(<Footer choice="signal" onChoose={onChoose} />)

  const choices = within(screen.getByRole("group", { name: "Hero" }))
  const buttons = choices.getAllByRole("button")
  expect(buttons.map((b) => b.textContent)).toEqual([
    "Messenger",
    "Signal",
    "Vortex",
    "Rotate",
  ])
  expect(
    buttons.filter((b) => b.getAttribute("aria-pressed") === "true")
  ).toEqual([choices.getByRole("button", { name: "Signal" })])
  for (const button of buttons)
    expect(button.className).toContain("focus-visible:outline-2")
  fireEvent.click(choices.getByRole("button", { name: "Rotate" }))
  expect(onChoose).toHaveBeenCalledWith("rotate")
})
