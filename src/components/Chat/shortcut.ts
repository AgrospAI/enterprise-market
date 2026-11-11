const isMac = (): boolean =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** ⌘/ on a Mac, Ctrl+/ elsewhere: opens and closes the assistant. */
export function isToggleShortcut(event: KeyboardEvent): boolean {
  return (
    event.key === '/' &&
    (isMac() ? event.metaKey : event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

export function shortcutLabel(): string {
  return isMac() ? '⌘/' : 'Ctrl+/'
}
