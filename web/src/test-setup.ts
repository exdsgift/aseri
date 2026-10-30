// jsdom has no matchMedia: answer as a browser with no preference set. A test that
// needs one stubs its own.
window.matchMedia = (media: string) =>
  ({
    media,
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }) as unknown as MediaQueryList
