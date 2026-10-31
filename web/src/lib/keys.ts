import { useEffect, useEffectEvent } from "react"

// A key the page may take as a shortcut: one with no modifier, and not meant for a
// field with the focus, which takes its own keys.
export const isShortcut = (event: KeyboardEvent) =>
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !(
    event.target instanceof Element &&
    event.target.closest("input, textarea, select, [contenteditable]")
  )

// Calls `onKey` with each key pressed as a shortcut: one listener for the component's
// life, which always reaches the latest `onKey`.
export function useShortcuts(onKey: (key: string) => void) {
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (isShortcut(event)) onKey(event.key)
  })
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onShortcut(event)
    addEventListener("keydown", listener)
    return () => removeEventListener("keydown", listener)
  }, [])
}
