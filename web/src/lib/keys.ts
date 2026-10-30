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
