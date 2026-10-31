import { useState } from "react"

// The heroes, in the order they take turns.
export const heroes = ["messenger", "signal", "vortex"] as const
export type HeroName = (typeof heroes)[number]
// A hero the reader picked, or the turns.
export type Choice = HeroName | "rotate"

const turnKey = "aseri.turn"
const choiceKey = "aseri.hero"

// The hero a page load shows on rotation: the one after the last load's, whose index the
// reader's storage keeps. Where the browser refuses storage (a private window, blocked
// site data), a random one, so the reader still sees them all.
export function nextTurn(storage = () => localStorage, random = Math.random) {
  try {
    const store = storage()
    const last = store.getItem(turnKey)
    const next = last && heroes[+last] ? (+last + 1) % heroes.length : 0
    store.setItem(turnKey, String(next))
    return heroes[next]
  } catch {
    return heroes[Math.floor(random() * heroes.length)]
  }
}

export function storedChoice(storage = () => localStorage): Choice {
  try {
    const choice = storage().getItem(choiceKey)
    return heroes.find((hero) => hero === choice) ?? "rotate"
  } catch {
    return "rotate"
  }
}

export function storeChoice(choice: Choice, storage = () => localStorage) {
  try {
    storage().setItem(choiceKey, choice)
  } catch {
    // Remembered for this page only.
  }
}

// This page load's turn, taken once however often the page renders.
let turn: HeroName | undefined
const thisTurn = () => (turn ??= nextTurn())

// The hero on show, and the reader's choice, remembered in their browser.
export function useHero() {
  const [choice, setChoice] = useState(() => storedChoice())
  return {
    hero: choice === "rotate" ? thisTurn() : choice,
    choice,
    choose: (next: Choice) => {
      setChoice(next)
      storeChoice(next)
    },
  }
}
