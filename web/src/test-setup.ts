// jsdom has no matchMedia: each query gets one list, which answers as a browser with
// no preference set. A test sets `matches` on it, and dispatches "change" if it must.
const lists = new Map<string, MediaQueryList>()
window.matchMedia = (media: string) => {
  if (!lists.has(media))
    lists.set(
      media,
      Object.assign(new EventTarget(), { media, matches: false }) as never
    )
  return lists.get(media)!
}

// jsdom has no IntersectionObserver either: this one never calls back, so whatever it
// watches stays on screen. A test stubs its own to move something off screen.
window.IntersectionObserver = class {
  observe() {}
  disconnect() {}
} as never
